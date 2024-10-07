import axios, { type AxiosResponse, type AxiosRequestConfig, type RawAxiosRequestHeaders, type AxiosInstance } from 'axios'
import { type Repository, type User, type Event, type Table, type MasterItem, type Order, type MasterTable, type Item, type CompleteOrderInput } from "../../../models/src"
import router from '@/router'
import { UserStore, SnackbarStore, type IUser } from '@/stores'
import type { StoreDefinition } from 'pinia'

export default class Axios {
    client: AxiosInstance
    config: AxiosRequestConfig = {
        headers: {
            'Content-Type': 'application/json'
        } as RawAxiosRequestHeaders,
    }
    userStoreDef: StoreDefinition
    snackbarStoreDef: StoreDefinition

    constructor() {
        this.client = axios.create({
            baseURL: '/api',
        })

        this.client.interceptors.response.use((response) => {
            return response
        }, error => {
            if (error.response) {
                if (error.response.status === 401) {
                  // Redirect to login page
                  router.push('/login')
                } else {
                  // Show a generic error message
                  const snackbar = SnackbarStore()
                  snackbar.show("Si è verificare un errore", 3000, 'top')
                }
              }
              return Promise.reject(error)
        })

        this.userStoreDef = UserStore
        this.snackbarStoreDef = SnackbarStore
    }

    private async get<T extends Repository>(path: string): Promise<T[]> {
        const response: AxiosResponse<T[]> = await this.client.get<T[]>(path, this.config)
        return response.data
    }

    private async getSingle<T extends Repository>(path: string): Promise<T> {
        const response: AxiosResponse<T> = await this.client.get<T>(path, this.config)
        return response.data
    }

    private async post<T extends Repository>(path: string, body: T): Promise<number> {
        const response: AxiosResponse<number> = await this.client.post(path, body, this.config)
        return response.data
    }

    private async put<T extends Repository>(path: string, body: T): Promise<number> {
        const response: AxiosResponse<number> = await this.client.put(path, body, this.config)
        return response.data
    }

    async GetAllEvents(): Promise<Event[]> {
        return await this.get<Event>("/events")
    }

    async GetAvailableTables(event_id: number): Promise<Table[]> {
        return await this.get<Table>(`/events/${event_id}/tables/available`)
    }

    async GetMasterTable(master_id: string): Promise<MasterTable> {
        return await this.getSingle<MasterTable>(`/master-tables/${master_id}`)
    }

    async GetOnGoingEvent(): Promise<Event> {
        return await this.getSingle<Event>("/events/ongoing")
    }

    async GetAllMasterItems(): Promise<MasterItem[]> {
        return await this.get<MasterItem>("/master-items")
    }

    async GetOrdersInEvent(event_id: number, destinations_ids: string): Promise<Order[]> {
        return await this.get<Order>(`/orders/${event_id}/${destinations_ids}`)
    }

    async GetTablesInEvent(event_id: number, destinations_ids: string): Promise<Order[]> {
        return await this.get<Order>(`/events/${event_id}/tables`)
    }

    async CreateEvent(event: Event): Promise<Number> {
        return await this.post("/events", event)
    }

    async CreateOrder(order: Order) : Promise<Number> {
        return await this.post("/orders", order)
    }

    async UpdateItem(item: Item) : Promise<Number> {
        return await this.put("/items", item)
    }

    async CompleteOrder(order_id: number, input: CompleteOrderInput): Promise<Number> {
        const response: AxiosResponse<number> = await this.client.put(`/orders/${order_id}/complete`, input, this.config)
        return response.data
    }

    async CompleteTable(table_id: number): Promise<Number> {
        const response: AxiosResponse<number> = await this.client.put(`/tables/${table_id}/complete`, {}, this.config)
        return response.data
    }

    async Login(email: string, password: string): Promise<void> {
        const user = (await this.client.post<User>("/login", {
            email: email,
            password: password
        })).data
        this.userStoreDef().login(user)
    }

    async Logout() {
        await this.client.post('/logout')
        this.userStoreDef().logout()
        router.push("/login")
        this.snackbarStoreDef().show("Logout effettuato con successo")
    }

    async CheckAuthentication(): Promise<IUser> {
        return (await this.client.get<IUser>('/checkauthentication')).data
    }
}

