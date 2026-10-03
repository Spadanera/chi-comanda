import type {
    AvailableTable, Audit, Broadcast, CompleteOrderInput, Destination, Event, Invitation, Item, MasterItem, MasterTable,
    Feature, Menu, Order, PaymentSetting, PaymentTransaction, PublicConfig, RestaurantLayout, Settings, SubType, Table, Type,
    User, VenueSummary
} from '../../../models/src'
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore } from '@/stores'
import { recreateSocket } from '@/composables/useSocket'
import { loadConfig } from '@/composables/useConfig'

export interface PaymentPayload {
    table_id: number
    event_id: number
    amount: number
    item_ids: number[]
    description: string
}

export type EventFilters = { page?: number, start?: string | null, end?: string | null }

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

/** Error thrown for any failed request; `status` is 0 when the server couldn't be reached. */
export class ApiError extends Error {
    constructor(public status: number, message: string, public path: string) {
        super(message)
        this.name = 'ApiError'
    }
}

const BASE_URL = '/api'

/**
 * Statuses after which an idempotent request is sent again with the same key: the network or the proxy failed, the
 * server may or may not have done it, and the key makes a second execution impossible.
 */
const RETRYABLE_STATUSES = [0, 502, 503, 504]
/** Waits before the automatic retries of an idempotent request. */
const RETRY_DELAYS_MS = [500, 1500, 3000]
/** Beyond this an idempotent request is given up as a network error (and retried, or queued). */
const IDEMPOTENT_TIMEOUT_MS = 20000

export const isRetryable = (error: unknown): boolean => error instanceof ApiError && RETRYABLE_STATUSES.includes(error.status)

/** A new `Idempotency-Key`: one per action of the user, kept across the retries of that action. */
export function newIdempotencyKey(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    // randomUUID needs a secure context: same format from getRandomValues
    const b = crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const hex = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface IdempotentOptions {
    /** Defaults to a new key. */
    key?: string
    /** Automatic retries on a network error (default 3). */
    retries?: number
    /** false: the caller handles the error (no message to the user). */
    report?: boolean
}

interface RequestOptions {
    idempotencyKey?: string
    timeoutMs?: number
    /** false: the error is thrown without being shown. */
    report?: boolean
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Answer of the venue api when the session has no venue (see requireVenue on the server). */
const NO_VENUE = 'Nessun locale selezionato'

/** Requests that must not toggle the global progress bar. */
const SILENT_PATHS = ['/checkauthentication']

function buildUrl(path: string, params?: Record<string, unknown>): string {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params || {})) {
        if (value !== undefined && value !== null && value !== '') query.append(key, String(value))
    }
    const qs = query.toString()
    return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`
}

async function parseBody(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return undefined
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

/**
 * Typed client of the REST API, built on the native fetch. A single shared instance
 * (`api`) is exported; stores are resolved lazily because they import this module too.
 */
class ApiClient {
    private async request<T>(method: Method, path: string, body?: unknown, params?: Record<string, unknown>,
        options: RequestOptions = {}): Promise<T> {
        const silent = SILENT_PATHS.includes(path)
        const report = (error: ApiError) => options.report === false ? error : this.handleError(error)
        const headers: Record<string, string> = {}
        const init: RequestInit = { method, credentials: 'same-origin', headers }
        if (body instanceof FormData) {
            init.body = body
        } else if (body !== undefined) {
            init.body = JSON.stringify(body)
            headers['Content-Type'] = 'application/json'
        }
        if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
        if (options.timeoutMs) init.signal = AbortSignal.timeout(options.timeoutMs)

        if (!silent) this.trackRequest(+1)
        try {
            let response: Response
            try {
                response = await fetch(buildUrl(path, params), init)
            } catch {
                throw report(new ApiError(0, 'Errore di connessione', path))
            }
            const data = await parseBody(response)
            if (!response.ok) {
                const message = (data as { message?: string } | undefined)?.message || response.statusText
                throw report(new ApiError(response.status, message, path))
            }
            return data as T
        } finally {
            if (!silent) this.trackRequest(-1)
        }
    }

    private trackRequest(delta: number) {
        const progress = ProgressStore()
        progress.activeRequestCount = Math.max(0, progress.activeRequestCount + delta)
        if (progress.activeRequestCount > 0) {
            progress.loading = true
        } else {
            // Small delay so back-to-back requests don't make the bar flicker
            setTimeout(() => {
                if (progress.activeRequestCount === 0) progress.loading = false
            }, 200)
        }
    }

    /** Shows the error to the user (or redirects to login) and returns it, to be thrown. */
    private handleError(error: ApiError): ApiError {
        const snackbar = SnackbarStore()
        if (error.status === 0) {
            snackbar.show(error.message, 3000, 'top', 'error')
        } else if (error.status === 401 && error.path === '/login') {
            snackbar.show(error.message || 'Credenziali non valide', 3000, 'top', 'error')
        } else if (error.status === 401) {
            UserStore().logout()
            router.push('/login')
        } else if (error.status === 403) {
            snackbar.show('Non sei autorizzato a eseguire questa operazione', 3000, 'top', 'error')
        } else if (error.status === 409 && error.message === NO_VENUE) {
            // The venue was disabled or the role revoked meanwhile: choose again
            UserStore().checkAuthentication().then(() => router.push({ name: 'Locale' }))
        } else if (error.status < 500) {
            snackbar.show(error.message, 3000, 'top', 'error')
        } else {
            snackbar.show('Si è verificato un errore', 3000, 'top', 'error')
        }
        return error
    }

    /**
     * An operation the server runs once per `Idempotency-Key` (orders, table closing, payments): on a network error
     * it is sent again with the same key, so it never happens twice.
     */
    private async idempotent<T>(method: Method, path: string, body: unknown, options: IdempotentOptions = {}): Promise<T> {
        const key = options.key || newIdempotencyKey()
        const retries = options.retries ?? RETRY_DELAYS_MS.length
        for (let attempt = 0; ; attempt++) {
            try {
                return await this.request<T>(method, path, body, undefined,
                    { idempotencyKey: key, timeoutMs: IDEMPOTENT_TIMEOUT_MS, report: false })
            } catch (error) {
                if (isRetryable(error) && attempt < retries) {
                    await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)])
                    continue
                }
                throw options.report === false ? error : this.handleError(error as ApiError)
            }
        }
    }

    private get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
        return this.request<T>('GET', path, undefined, params)
    }

    private post<T = number>(path: string, body?: unknown): Promise<T> {
        return this.request<T>('POST', path, body)
    }

    private put<T = number>(path: string, body?: unknown): Promise<T> {
        return this.request<T>('PUT', path, body)
    }

    private delete<T = number>(path: string): Promise<T> {
        return this.request<T>('DELETE', path)
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    async Login(email: string, password: string): Promise<void> {
        const user = await this.post<User>('/login', { email, password })
        // The session id changed: reconnect so the server sees the logged user
        recreateSocket()
        UserStore().login(user)
        // Branding and functions of the venue the user entered
        await loadConfig()
    }

    /** `redirect`: page of the app to open after the login. */
    loginWithGoogle(invitationToken?: string, redirect?: string) {
        const query = new URLSearchParams()
        if (invitationToken) query.set('state', invitationToken)
        if (redirect) query.set('redirect', redirect)
        const search = query.toString()
        window.location.href = `/api/auth/google${search ? `?${search}` : ''}`
    }

    async Logout() {
        await this.post('/logout')
        UserStore().logout()
        // Leave the screens (and their rooms) before opening the anonymous socket
        await router.push('/login')
        recreateSocket()
        await loadConfig()
        SnackbarStore().show('Logout effettuato con successo')
    }

    /**
     * Works in another venue: the screens, the real-time rooms and the branding follow it. Each view loads its
     * data again, as after a login.
     */
    async SwitchVenue(venueId: number): Promise<void> {
        const user = await this.put<User>('/session/venue', { venueId })
        UserStore().login(user)
        await loadConfig()
        // The server dropped the sockets of the old venue: open a fresh one, it joins the rooms of the new venue
        recreateSocket()
    }

    /** The logged user, or `0` when there is no session. */
    CheckAuthentication(): Promise<User | 0> {
        return this.get('/checkauthentication')
    }

    async AskReset(email: string) {
        await this.post('/public/askreset', { email })
        SnackbarStore().show('Richiesta effettuata. Riceverai una mail con le istruzioni per reimpostare la tua password')
        router.push('/login')
    }

    async Reset(invitation: Invitation) {
        await this.post('/public/reset', invitation)
        SnackbarStore().show('Password reimpostata con successo', 3000, 'top', 'success')
        router.push('/login')
    }

    async AcceptInvitation(formData: FormData) {
        await this.post('/public/invitation/accept', formData)
        SnackbarStore().show('Invito accettato con successo', 3000, 'top', 'success')
        router.push('/login')
    }

    // ── Events ───────────────────────────────────────────────────────────────

    GetAllEvents(status: string, filters?: EventFilters): Promise<Event[] | { events: Event[], totalPages: number }> {
        return this.get(`/events/status/${status}`, {
            page: filters?.page || undefined,
            start_date: filters?.start || undefined,
            end_date: filters?.end || undefined,
        })
    }

    GetEvent(event_id: number, status: string): Promise<Event> {
        return this.get(`/events/${event_id}/status/${status}`)
    }

    GetOnGoingEvent(): Promise<Event> {
        return this.get('/events/ongoing')
    }

    CreateEvent(event: Event): Promise<number> {
        return this.post('/events', event)
    }

    SetEventStatus(event: Event): Promise<number> {
        return this.put(`/events/setstatus/${event.id}`, { id: event.id, status: event.status })
    }

    EditEvent(event: Event): Promise<number> {
        return this.put('/events', event)
    }

    DeleteEvent(event_id: number): Promise<number> {
        return this.delete(`/events/${event_id}`)
    }

    GetAvailableUsers(): Promise<User[]> {
        return this.get('/events/users')
    }

    // ── Tables ───────────────────────────────────────────────────────────────

    GetWaiterLayout(event_id: number): Promise<RestaurantLayout> {
        return this.get(`/events/${event_id}/tables/layout`)
    }

    SaveLayoutInEvent(layout: RestaurantLayout, event_id: number): Promise<number> {
        return this.put(`/events/${event_id}/tables/layout`, layout)
    }

    GetFreeTables(event_id: number): Promise<AvailableTable[]> {
        return this.get(`/events/${event_id}/tables/free`)
    }

    GetTablesInEvent(event_id: number): Promise<Table[]> {
        return this.get(`/events/${event_id}/tables`)
    }

    InsertMultipleTables(event_id: number, tableNames: string[]): Promise<number> {
        return this.post(`/events/${event_id}/tables/multiple`, tableNames)
    }

    InsertDiscount(event_id: number, table_id: number, discount: number): Promise<number> {
        return this.post(`/events/${event_id}/tables/${table_id}/discount/${discount}`)
    }

    ChangeTable(table_id: number, master_table_id: number): Promise<number> {
        return this.put(`/tables/${table_id}/change/${master_table_id}`)
    }

    GetTable(table_id: string): Promise<Table> {
        return this.get(`/tables/${table_id}`)
    }

    CompleteTable(table_id: number): Promise<number> {
        return this.idempotent('PUT', `/tables/${table_id}/complete`, undefined)
    }

    PaySelectedItem(table_id: number, item_ids: number[]): Promise<number> {
        return this.idempotent('PUT', `/tables/${table_id}/payitems`, item_ids)
    }

    /** A table of the ongoing event layout, or `0` when it doesn't exist. */
    GetMasterTable(master_id: string): Promise<MasterTable> {
        return this.get(`/master-tables/${master_id}`)
    }

    GetLayout(): Promise<RestaurantLayout> {
        return this.get('/master-tables/layout')
    }

    SaveLayout(layout: RestaurantLayout): Promise<number> {
        return this.put('/master-tables/layout', layout)
    }

    // ── Orders and items ─────────────────────────────────────────────────────

    GetOrdersInEvent(event_id: number, destinations_ids: string): Promise<Order[]> {
        return this.get(`/orders/${event_id}/[${destinations_ids}]`)
    }

    /** Returns the id of the order's table. The offline queue passes the key of the order it holds. */
    CreateOrder(order: Order, options?: IdempotentOptions): Promise<number> {
        return this.idempotent('POST', '/orders', order, options)
    }

    CompleteOrder(order_id: number, input: CompleteOrderInput): Promise<number> {
        return this.put(`/orders/${order_id}/complete`, input)
    }

    UpdateItem(item: Item, reopenTable?: boolean): Promise<number> {
        return this.put(`/items${reopenTable ? '/open' : ''}`, item)
    }

    DeleteItem(item_id: number): Promise<number> {
        return this.delete(`/items/${item_id}`)
    }

    // ── Catalogue ────────────────────────────────────────────────────────────

    GetAllMenu(): Promise<Menu[]> {
        return this.get('/menu')
    }

    CreateMenu(menu: Menu): Promise<number> {
        return this.post('/menu', menu)
    }

    EditMenu(menu: Menu): Promise<number> {
        return this.put('/menu', menu)
    }

    DeleteMenu(id: number): Promise<number> {
        return this.delete(`/menu/${id}`)
    }

    GetAllMasterItems(menu_id: number): Promise<MasterItem[]> {
        return this.get(`/master-items/${menu_id}`)
    }

    GetAvailableMasterItems(menu_id: number): Promise<MasterItem[]> {
        return this.get(`/master-items/available/${menu_id}`)
    }

    CreateMasterItems(masterItem: MasterItem): Promise<number> {
        return this.post('/master-items', masterItem)
    }

    EditMasterItems(masterItem: MasterItem): Promise<number> {
        return this.put('/master-items', masterItem)
    }

    GetTypes(): Promise<Type[]> {
        return this.get('/types')
    }

    CreateType(type: Type): Promise<number> {
        return this.post('/types', type)
    }

    EditType(type: Type): Promise<number> {
        return this.put('/types', type)
    }

    DeleteType(id: number): Promise<number> {
        return this.delete(`/types/${id}`)
    }

    GetSubTypes(): Promise<SubType[]> {
        return this.get('/subtypes')
    }

    CreateSubType(subType: SubType): Promise<number> {
        return this.post('/subtypes', subType)
    }

    EditSubType(subType: SubType): Promise<number> {
        return this.put('/subtypes', subType)
    }

    DeleteSubType(id: number): Promise<number> {
        return this.delete(`/subtypes/${id}`)
    }

    GetDestinations(): Promise<Destination[]> {
        return this.get('/destinations')
    }

    CreateDestination(destination: Destination): Promise<number> {
        return this.post('/destinations', destination)
    }

    EditDestination(destination: Destination): Promise<number> {
        return this.put('/destinations', destination)
    }

    // ── Users and profile ────────────────────────────────────────────────────

    GetUsers(): Promise<User[]> {
        return this.get('/users')
    }

    /** Accounts that can be added to the venue by picking them instead of typing the e-mail. */
    GetUserCandidates(): Promise<User[]> {
        return this.get('/users/candidates')
    }

    UpdateUser(user: User): Promise<number> {
        return this.put('/users', user)
    }

    UpdateUserRoles(user: User): Promise<number> {
        return this.put('/users/roles', user)
    }

    DeleteUser(user_id: number): Promise<number> {
        return this.delete(`/users/${user_id}`)
    }

    InviteUser(user: User): Promise<number> {
        return this.post('/users/invite', user)
    }

    // ── Platform (superuser) ─────────────────────────────────────────────────

    GetVenues(): Promise<VenueSummary[]> {
        return this.get('/platform/venues')
    }

    CreateVenue(venue: { name: string, features: Feature[] | null, admin_email?: string }): Promise<number> {
        return this.post('/platform/venues', venue)
    }

    UpdateVenue(id: number, venue: Partial<Pick<VenueSummary, 'name' | 'status' | 'features'>>): Promise<void> {
        return this.put(`/platform/venues/${id}`, venue)
    }

    GetPlatformUsers(): Promise<User[]> {
        return this.get('/platform/users')
    }

    SetUserStatus(id: number, status: 'ACTIVE' | 'BLOCKED'): Promise<void> {
        return this.put(`/platform/users/${id}/status`, { status })
    }

    SetSuperuser(id: number, superuser: boolean): Promise<void> {
        return this.put(`/platform/users/${id}/superuser`, { superuser })
    }

    GetUserAvatar(id: number): Promise<string> {
        return this.get(`/users-public/avatar/${id}`)
    }

    EditProfileAvatar(formData: FormData, id: number): Promise<string> {
        return this.put(`/profile/avatar/${id}`, formData)
    }

    EditProfileUsername(user: User): Promise<number> {
        return this.put('/profile/username', user)
    }

    BroadcastMessage(broadcast: Broadcast): Promise<void> {
        return this.post('/broadcast', broadcast)
    }

    GetAudit(page: number, itemsPerPage: number, sortBy: string, sortDir: string): Promise<{ data: Audit[], totalCount: number }> {
        return this.get('/audit', { page, itemsperpage: itemsPerPage, sortby: sortBy, sortdir: sortDir })
    }

    // ── Push notifications ───────────────────────────────────────────────────

    GetPushConfig(): Promise<{ enabled: boolean, publicKey: string | null }> {
        return this.get('/push/config')
    }

    /** `null` when the user has never been asked. */
    async GetPushPreference(): Promise<boolean | null> {
        return (await this.get<{ preference: boolean | null }>('/push/preference')).preference
    }

    SetPushPreference(enabled: boolean): Promise<void> {
        return this.put('/push/preference', { enabled })
    }

    SavePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.post('/push/subscriptions', subscription)
    }

    // ── Installation settings (branding) ─────────────────────────────────────

    GetPublicConfig(): Promise<PublicConfig> {
        return this.get('/public/config')
    }

    GetSettings(): Promise<Settings> {
        return this.get('/settings')
    }

    SaveSettings(settings: Settings): Promise<Settings> {
        return this.put('/settings', settings)
    }

    UploadLogo(formData: FormData): Promise<Settings> {
        return this.put('/settings/logo', formData)
    }

    DeleteLogo(): Promise<Settings> {
        return this.delete('/settings/logo')
    }

    // ── Payments ─────────────────────────────────────────────────────────────

    GetPaymentSettings(): Promise<PaymentSetting[]> {
        return this.get('/payment/settings')
    }

    SavePaymentSettings(setting: PaymentSetting): Promise<number> {
        return this.post('/payment/settings', setting)
    }

    GetAvailablePaymentProviders(): Promise<PaymentSetting[]> {
        return this.get('/payment/available')
    }

    /** sumup_checkout: payment link / QR code */
    CreateSumupCheckoutLink(payload: PaymentPayload): Promise<PaymentTransaction> {
        return this.idempotent('POST', '/payment/checkout/sumup-checkout', payload)
    }

    /** sumup_pos: returns the `url_scheme` that opens the SumUp app */
    CreateSumupPosSession(payload: PaymentPayload): Promise<PaymentTransaction & { url_scheme: string }> {
        return this.idempotent('POST', '/payment/checkout/sumup-pos', payload)
    }

    /** sumup_solo: sends the payment to the Solo terminal */
    CreateSumupSoloPayment(payload: PaymentPayload): Promise<PaymentTransaction> {
        return this.idempotent('POST', '/payment/checkout/sumup-solo', payload)
    }

    /** Polled by sumup_checkout and sumup_solo */
    CheckPaymentStatus(transaction_id: number): Promise<{ status: string }> {
        return this.get(`/payment/checkout/${transaction_id}/status`)
    }
}

const api = new ApiClient()

export default api
