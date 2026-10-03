import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/router', () => ({ default: { push: vi.fn(async () => undefined) } }))
vi.mock('@/composables/useSocket', () => ({ recreateSocket: vi.fn(), onSocketCreated: vi.fn(() => () => undefined) }))
vi.mock('@/composables/useConfig', () => ({ loadConfig: vi.fn(async () => undefined) }))

type Outbox = typeof import('@/services/outbox')
let outbox: Outbox
let stores: typeof import('@/stores')

const ORDER = { event_id: 7, table_name: 'Tavolo 5', items: [{ master_item_id: 1 }] } as any
const offline = () => { throw new TypeError('Failed to fetch') }
const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

/** What is stored in IndexedDB, read by a fresh copy of the module (as after a page reload). */
async function storedEntries() {
    vi.resetModules()
    const fresh: Outbox = await import('@/services/outbox')
    await fresh.flush().catch(() => undefined)
    const db: IDBDatabase = await new Promise((resolve, reject) => {
        const r = indexedDB.open('chi-comanda', 1)
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
    })
    return new Promise<any[]>(resolve => {
        const r = db.transaction('outbox').objectStore('outbox').getAll()
        r.onsuccess = () => { db.close(); resolve(r.result) }
    })
}

function loginAs(id: number, venueId: number) {
    stores.UserStore().login({ id, username: `u${id}`, venueId, venues: [{ id: venueId, name: `Locale ${venueId}`, roles: ['waiter'] }] } as any)
}

const keyOf = (call: any[]) => (call[1].headers as Record<string, string>)['Idempotency-Key']

beforeEach(async () => {
    vi.resetModules()
    globalThis.indexedDB = new IDBFactory()
    setActivePinia(createPinia())
    outbox = await import('@/services/outbox')
    stores = await import('@/stores')
    setActivePinia(createPinia())
    loginAs(1, 10)
})

afterEach(() => { vi.unstubAllGlobals() })

describe('offline queue', () => {
    it('sends the order and leaves nothing behind', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => answer(200, 33)))
        expect(await outbox.sendOrder(ORDER)).toEqual({ queued: false, tableId: 33 })
        expect(outbox.myQueue.value).toEqual([])
    })

    it('stores the order before sending it', async () => {
        let storedWhileSending: unknown[] = []
        vi.stubGlobal('fetch', vi.fn(async () => {
            const r = await new Promise<any[]>(resolve => {
                const open = indexedDB.open('chi-comanda', 1)
                open.onsuccess = () => { const g = open.result.transaction('outbox').objectStore('outbox').getAll(); g.onsuccess = () => resolve(g.result) }
            })
            storedWhileSending = r
            return answer(200, 1)
        }))
        await outbox.sendOrder(ORDER)
        expect(storedWhileSending).toHaveLength(1)
    })

    it('queues the order on a network error and keeps it across a reload', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('fetch', vi.fn(offline))
        const sent = outbox.sendOrder(ORDER)
        await vi.runAllTimersAsync()
        expect(await sent).toEqual({ queued: true })
        vi.useRealTimers()

        expect(outbox.venueQueue.value).toMatchObject([{ status: 'pending', error: 'Nessuna connessione', order: ORDER, userId: 1, venueId: 10 }])
        const [stored] = await storedEntries()
        expect(stored).toMatchObject({ status: 'pending', order: ORDER })
    })

    it('sends the queue again with the same key once the network is back', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn(offline)
        vi.stubGlobal('fetch', fetchMock)
        const sent = outbox.sendOrder(ORDER)
        await vi.runAllTimersAsync()
        await sent
        vi.useRealTimers()

        fetchMock.mockImplementation(async () => answer(200, 33) as never)
        await outbox.flush()
        const keys = fetchMock.mock.calls.map(keyOf)
        expect(new Set(keys).size).toBe(1)
        expect(keys.length).toBeGreaterThanOrEqual(3)
        expect(outbox.myQueue.value).toEqual([])
        expect(stores.SnackbarStore().text).toBe('Ordine in attesa inviato')
    })

    it('does not queue an order the server refuses', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => answer(400, { message: 'Serata chiusa' })))
        await expect(outbox.sendOrder(ORDER)).rejects.toMatchObject({ status: 400 })
        expect(outbox.myQueue.value).toEqual([])
        expect(stores.SnackbarStore().text).toBe('Serata chiusa')
    })

    it('keeps a queued order refused later as failed, for the waiter to decide', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn(offline)
        vi.stubGlobal('fetch', fetchMock)
        const sent = outbox.sendOrder(ORDER)
        await vi.runAllTimersAsync()
        await sent
        vi.useRealTimers()

        fetchMock.mockImplementation(async () => answer(400, { message: 'Serata chiusa' }) as never)
        await outbox.flush()
        expect(outbox.venueQueue.value).toMatchObject([{ status: 'failed', error: 'Serata chiusa' }])
        // Not sent again by itself
        await outbox.flush()
        expect(fetchMock.mock.calls.filter(c => c).length).toBe(3)

        fetchMock.mockImplementation(async () => answer(200, 1) as never)
        await outbox.retry(outbox.venueQueue.value[0].key)
        expect(outbox.myQueue.value).toEqual([])
    })

    it('discards an order only on request', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('fetch', vi.fn(offline))
        const sent = outbox.sendOrder(ORDER)
        await vi.runAllTimersAsync()
        await sent
        vi.useRealTimers()
        await outbox.discard(outbox.venueQueue.value[0].key)
        expect(await storedEntries()).toEqual([])
    })

    it('keeps the order when the session expired, and sends nothing meanwhile', async () => {
        const fetchMock = vi.fn(async () => answer(401, { message: 'Unauthorized' }))
        vi.stubGlobal('fetch', fetchMock)
        expect(await outbox.sendOrder(ORDER)).toEqual({ queued: true })
        // The usual handling of an expired session: logged out
        expect(stores.UserStore().isLoggedIn).toBe(false)
        fetchMock.mockClear()
        await outbox.flush()
        expect(fetchMock).not.toHaveBeenCalled()

        // Logged in again: there it is, and it leaves
        loginAs(1, 10)
        expect(outbox.venueQueue.value).toMatchObject([{ status: 'pending' }])
        fetchMock.mockImplementation(async () => answer(200, 1))
        await outbox.flush()
        expect(outbox.myQueue.value).toEqual([])
    })

    it('sends an order only in its venue, by its user', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn(offline)
        vi.stubGlobal('fetch', fetchMock)
        const sent = outbox.sendOrder(ORDER)
        await vi.runAllTimersAsync()
        await sent
        vi.useRealTimers()
        fetchMock.mockReset()
        fetchMock.mockImplementation(async () => answer(200, 1) as never)

        // Another venue: the order waits, and is not listed for this venue
        loginAs(1, 20)
        await outbox.flush()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(outbox.venueQueue.value).toEqual([])
        expect(outbox.myQueue.value).toHaveLength(1)

        // Another user of the device: neither sent nor shown
        loginAs(2, 10)
        await outbox.flush()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(outbox.myQueue.value).toEqual([])

        // Back to the right user and venue
        loginAs(1, 10)
        await outbox.flush()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(await storedEntries()).toEqual([])
    })

    it('keeps the queue in memory when IndexedDB is unavailable', async () => {
        vi.resetModules()
        globalThis.indexedDB = { open: () => { throw new Error('denied') } } as any
        outbox = await import('@/services/outbox')
        stores = await import('@/stores')
        setActivePinia(createPinia())
        loginAs(1, 10)
        vi.stubGlobal('fetch', vi.fn(async () => answer(503, {})))
        vi.useFakeTimers()
        const sent = outbox.sendOrder(ORDER)
        await vi.runAllTimersAsync()
        expect(await sent).toEqual({ queued: true })
        vi.useRealTimers()
        expect(outbox.outboxPersistent.value).toBe(false)
        expect(outbox.venueQueue.value).toHaveLength(1)
    })
})
