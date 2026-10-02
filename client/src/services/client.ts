import type {
    AvailableTable, Audit, Broadcast, CompleteOrderInput, Destination, Event, Invitation, Item, MasterItem, MasterTable,
    Menu, Order, PaymentSetting, PaymentTransaction, RestaurantLayout, SubType, Table, Type, User
} from '../../../models/src'
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore } from '@/stores'
import { recreateSocket } from '@/composables/useSocket'

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
    private async request<T>(method: Method, path: string, body?: unknown, params?: Record<string, unknown>): Promise<T> {
        const silent = SILENT_PATHS.includes(path)
        const init: RequestInit = { method, credentials: 'same-origin' }
        if (body instanceof FormData) {
            init.body = body
        } else if (body !== undefined) {
            init.body = JSON.stringify(body)
            init.headers = { 'Content-Type': 'application/json' }
        }

        if (!silent) this.trackRequest(+1)
        try {
            let response: Response
            try {
                response = await fetch(buildUrl(path, params), init)
            } catch {
                throw this.handleError(new ApiError(0, 'Errore di connessione', path))
            }
            const data = await parseBody(response)
            if (!response.ok) {
                const message = (data as { message?: string } | undefined)?.message || response.statusText
                throw this.handleError(new ApiError(response.status, message, path))
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
        } else if (error.status < 500) {
            snackbar.show(error.message, 3000, 'top', 'error')
        } else {
            snackbar.show('Si è verificato un errore', 3000, 'top', 'error')
        }
        return error
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
    }

    loginWithGoogle(invitationToken?: string) {
        window.location.href = invitationToken
            ? `/api/auth/google?state=${encodeURIComponent(invitationToken)}`
            : '/api/auth/google'
    }

    async Logout() {
        await this.post('/logout')
        UserStore().logout()
        // Leave the screens (and their rooms) before opening the anonymous socket
        await router.push('/login')
        recreateSocket()
        SnackbarStore().show('Logout effettuato con successo')
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
        return this.put(`/tables/${table_id}/complete`)
    }

    PaySelectedItem(table_id: number, item_ids: number[]): Promise<number> {
        return this.put(`/tables/${table_id}/payitems`, item_ids)
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

    CreateOrder(order: Order): Promise<number> {
        return this.post('/orders', order)
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
        return this.post('/payment/checkout/sumup-checkout', payload)
    }

    /** sumup_pos: returns the `url_scheme` that opens the SumUp app */
    CreateSumupPosSession(payload: PaymentPayload): Promise<PaymentTransaction & { url_scheme: string }> {
        return this.post('/payment/checkout/sumup-pos', payload)
    }

    /** sumup_solo: sends the payment to the Solo terminal */
    CreateSumupSoloPayment(payload: PaymentPayload): Promise<PaymentTransaction> {
        return this.post('/payment/checkout/sumup-solo', payload)
    }

    /** Polled by sumup_checkout and sumup_solo */
    CheckPaymentStatus(transaction_id: number): Promise<{ status: string }> {
        return this.get(`/payment/checkout/${transaction_id}/status`)
    }
}

const api = new ApiClient()

export default api
