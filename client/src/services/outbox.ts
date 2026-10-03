import { computed, ref, watch } from 'vue'
import type { Order } from '../../../models/src'
import api, { ApiError, isRetryable, newIdempotencyKey, NO_VENUE } from './client'
import { SnackbarStore, UserStore } from '@/stores'
import { onSocketCreated } from '@/composables/useSocket'

/**
 * Offline queue of orders. An order is written to IndexedDB **before** it is sent, with its idempotency key, and
 * deleted only when the server has confirmed it: if the network fails (or the page dies) it stays here, "in attesa di
 * invio", and is sent again with the same key, so it is never lost and never placed twice.
 *
 * An entry belongs to the user and the venue it was taken in: it is sent only while that user works in that venue
 * (after a venue switch or a logout it waits on the device), and other users of the device never see it.
 */

export type OutboxStatus = 'pending' | 'sending' | 'failed'

export interface QueuedOrder {
    /** Idempotency key, also the entry's id. */
    key: string
    userId: number
    venueId: number
    venueName: string
    order: Order
    createdAt: number
    status: OutboxStatus
    /** Last error (the server's message for a refused order). */
    error?: string
    attempts: number
    lastAttemptAt: number
}

export type SendResult = { queued: false, tableId: number } | { queued: true }

const DB_NAME = 'chi-comanda'
const STORE = 'outbox'
/** While something waits, a retry every so often, besides the reconnection events. */
export const RETRY_INTERVAL_MS = 15000
/** A `sending` entry older than this was left by a page that died while sending it: sent again (same key). */
const STALE_SENDING_MS = 60000

interface Storage {
    all(): Promise<QueuedOrder[]>
    put(entry: QueuedOrder): Promise<void>
    delete(key: string): Promise<void>
}

function promised<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

class IdbStorage implements Storage {
    constructor(private db: IDBDatabase) { }

    static async open(): Promise<IdbStorage> {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' })
        return new IdbStorage(await promised(request))
    }

    private store(mode: IDBTransactionMode) {
        return this.db.transaction(STORE, mode).objectStore(STORE)
    }

    all() {
        return promised(this.store('readonly').getAll() as IDBRequest<QueuedOrder[]>)
    }

    async put(entry: QueuedOrder) {
        await promised(this.store('readwrite').put(entry))
    }

    async delete(key: string) {
        await promised(this.store('readwrite').delete(key))
    }
}

/** Without IndexedDB (some private modes): the queue lives as long as the page, and the waiter is told. */
class MemoryStorage implements Storage {
    private entries = new Map<string, QueuedOrder>()
    async all() { return [...this.entries.values()] }
    async put(entry: QueuedOrder) { this.entries.set(entry.key, structuredClone(entry)) }
    async delete(key: string) { this.entries.delete(key) }
}

let storage: Promise<Storage> | null = null
/** False when orders are kept only in memory. */
export const outboxPersistent = ref(true)
/** Every entry on the device (all users): never shown as such, see `myQueue` / `venueQueue`. */
const entries = ref<QueuedOrder[]>([])
/** The dialog listing the orders waiting (opened from the app bar and the waiter's screen). */
export const outboxDialog = ref(false)

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('chi-comanda-outbox') : null
// Another tab changed the queue
channel?.addEventListener('message', () => { refresh().catch(() => undefined) })

function getStorage(): Promise<Storage> {
    if (!storage) {
        storage = IdbStorage.open().catch(error => {
            console.warn('Offline queue: IndexedDB unavailable, orders kept in memory only', error)
            outboxPersistent.value = false
            return new MemoryStorage()
        })
        // Asks the browser not to evict the queue under storage pressure
        void navigator.storage?.persist?.().catch(() => undefined)
    }
    return storage
}

async function refresh() {
    entries.value = (await (await getStorage()).all()).sort((a, b) => a.createdAt - b.createdAt)
}

async function save(entry: QueuedOrder) {
    await (await getStorage()).put(JSON.parse(JSON.stringify(entry)))
    await refresh()
    channel?.postMessage('changed')
}

async function remove(key: string) {
    await (await getStorage()).delete(key)
    await refresh()
    channel?.postMessage('changed')
}

const mine = (e: QueuedOrder) => e.userId === UserStore().id
/** Orders of the logged user, in every venue. */
export const myQueue = computed(() => entries.value.filter(mine))
/** Orders of the logged user in the venue they work in. */
export const venueQueue = computed(() => myQueue.value.filter(e => e.venueId === UserStore().venueId))

/** Errors after which the order may still reach the server: it stays queued. */
function staysQueued(error: unknown): boolean {
    return isRetryable(error) || (error instanceof ApiError && (error.status === 401 || (error.status === 409 && error.message === NO_VENUE)))
}

function describe(error: unknown): string {
    if (error instanceof ApiError) return error.status === 0 ? 'Nessuna connessione' : error.message
    return String(error)
}

/**
 * Sends an order taken by the waiter. On a network error it is queued (`{ queued: true }`) and sent later; an order
 * refused by the server is not queued: the error is shown and thrown, as for any request.
 */
export async function sendOrder(order: Order): Promise<SendResult> {
    const user = UserStore()
    const now = Date.now()
    const entry: QueuedOrder = {
        key: newIdempotencyKey(), userId: user.id, venueId: user.venueId!, venueName: user.venue?.name || '',
        order: JSON.parse(JSON.stringify(order)), createdAt: now, status: 'sending', attempts: 1, lastAttemptAt: now,
    }
    // Written before sending: if the page dies meanwhile, the order is still here and goes again with its key
    await save(entry)
    try {
        const tableId = await api.CreateOrder(entry.order, { key: entry.key, retries: 1, report: false })
        await remove(entry.key)
        return { queued: false, tableId }
    } catch (error) {
        if (staysQueued(error)) {
            await save({ ...entry, status: 'pending', error: describe(error) })
            // Session expired or no venue: the usual handling (login, venue choice); the order waits meanwhile
            if ((error as ApiError).status !== 0 && !isRetryable(error)) api.report(error as ApiError)
            return { queued: true }
        }
        await remove(entry.key)
        throw api.report(error as ApiError)
    }
}

let flushing: Promise<void> | null = null

/** Sends the queued orders of the current user and venue, oldest first. Calls during a flush share it. */
export function flush(): Promise<void> {
    if (!flushing) {
        const run = () => doFlush()
        // One tab at a time (the keys would make a duplicate harmless anyway)
        const locked = navigator.locks ? navigator.locks.request('chi-comanda-outbox', run) : run()
        flushing = Promise.resolve(locked).finally(() => { flushing = null })
    }
    return flushing
}

async function doFlush() {
    await refresh()
    const user = UserStore()
    if (!user.isLoggedIn || !user.venueId) return
    let sent = 0
    for (const entry of venueQueue.value) {
        const stale = entry.status === 'sending' && Date.now() - entry.lastAttemptAt > STALE_SENDING_MS
        if (entry.status !== 'pending' && !stale) continue
        const attempt = { ...entry, status: 'sending' as const, attempts: entry.attempts + 1, lastAttemptAt: Date.now() }
        await save(attempt)
        try {
            await api.CreateOrder(entry.order, { key: entry.key, retries: 0, report: false })
            await remove(entry.key)
            sent++
        } catch (error) {
            if (staysQueued(error)) {
                // Still offline (or the session needs attention): the next ones would fail the same way
                await save({ ...attempt, status: 'pending', error: describe(error) })
                break
            }
            // Refused (closed event, product removed…): the waiter decides, nothing is dropped silently
            await save({ ...attempt, status: 'failed', error: describe(error) })
        }
    }
    const failed = venueQueue.value.filter(e => e.status === 'failed').length
    if (failed) {
        SnackbarStore().show(`${failed === 1 ? 'Un ordine non è stato accettato' : `${failed} ordini non sono stati accettati`}: controlla gli ordini in attesa`,
            6000, 'top', 'error')
    } else if (sent) {
        SnackbarStore().show(sent === 1 ? 'Ordine in attesa inviato' : `${sent} ordini in attesa inviati`, 3000, 'top', 'success')
    }
}

/** A refused order sent again (e.g. after the admin reopened the product). */
export async function retry(key: string) {
    const entry = myQueue.value.find(e => e.key === key)
    if (!entry) return
    await save({ ...entry, status: 'pending', error: undefined })
    await flush()
}

/** Gives up an order: only on the waiter's explicit choice. */
export async function discard(key: string) {
    if (myQueue.value.some(e => e.key === key)) await remove(key)
}

/**
 * Loads the queue and sends it whenever the connection may be back: socket (re)connection, the browser going online,
 * the page becoming visible, and every `RETRY_INTERVAL_MS` while something waits. Returns a function that stops it.
 */
export function startOutbox(): () => void {
    const tryNow = () => {
        if (venueQueue.value.some(e => e.status !== 'failed')) void flush()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh().then(tryNow) }
    window.addEventListener('online', tryNow)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(tryNow, RETRY_INTERVAL_MS)
    const unregister = onSocketCreated(socket => socket.on('connect', tryNow))
    // Back in the venue (or logged in again) where orders wait
    const stopWatch = watch(() => [UserStore().id, UserStore().venueId], () => { void refresh().then(tryNow) })
    void refresh().then(tryNow)
    return () => {
        stopWatch()
        window.removeEventListener('online', tryNow)
        document.removeEventListener('visibilitychange', onVisible)
        window.clearInterval(timer)
        unregister()
    }
}
