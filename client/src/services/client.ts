import axios, { type AxiosResponse, type AxiosRequestConfig, type RawAxiosRequestHeaders, type AxiosInstance, type AxiosProgressEvent } from 'axios'
import { type AvailableTable, type Repository, type User, type Event, type Table, type MasterItem, type Order, type MasterTable, type Item, type CompleteOrderInput, type Destination, type Invitation, type Menu, type Type, type SubType, type Audit, type Broadcast } from "../../../models/src"
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore } from '@/stores'
import type { StoreDefinition } from 'pinia'

export default class Axios {
    client: AxiosInstance
    config: AxiosRequestConfig = {
        headers: {
            'Content-Type': 'application/json'
        } as RawAxiosRequestHeaders
    }
    userStoreDef: StoreDefinition
    snackbarStoreDef: StoreDefinition
    progressStoreDef: StoreDefinition

    constructor() {
        this.client = axios.create({
            baseURL: '/api',
        })

        this.client.interceptors.request.use((request) => {
            const progressStore = this.progressStoreDef()
            if (request.url !== "/checkauthentication") {
                progressStore.activeRequestCount++
                progressStore.loading = true;
            }
            return request
        }, error => {
            const progressStore = this.progressStoreDef()
            progressStore.activeRequestCount--
            setInterval(() => {
                if (progressStore.activeRequestCount === 0) {
                    progressStore.loading = false;
                }
            }, 200)
            return Promise.reject(error)
        })

        this.client.interceptors.response.use((response) => {
            const progressStore = this.progressStoreDef()
            if (response.config.url !== "/checkauthentication") {
                progressStore.activeRequestCount--
                setInterval(() => {
                    if (progressStore.activeRequestCount === 0) {
                        progressStore.loading = false;
                    }
                }, 200)
            }
            return response
        }, error => {
            const progressStore = this.progressStoreDef()
            progressStore.loading = false;
            if (error.response) {
                progressStore.activeRequestCount--
                setInterval(() => {
                    if (progressStore.activeRequestCount === 0) {
                        progressStore.loading = false;
                    }
                }, 200)
                if (error.response.status === 401) {
                    const userStore = this.userStoreDef()
                    userStore.logout()
                    router.push('/login')
                } else {
                    const snackbar = SnackbarStore()
                    snackbar.show("Si è verificare un errore", 3000, 'top', 'error')
                }
            }
            return Promise.reject(error)
        })

        this.userStoreDef = UserStore
        this.snackbarStoreDef = SnackbarStore
        this.progressStoreDef = ProgressStore
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

    private async delete(path: string): Promise<number> {
        const response: AxiosResponse<number> = await this.client.delete(path, this.config)
        return response.data
    }

    async GetAllEvents(): Promise<Event[]> {
        return await this.get<Event>("/events")
    }

    async GetEvent(event_id: number): Promise<Event> {
        return await this.getSingle<Event>(`/events/${event_id}`)
    }

    async GetOnGoingEvent(): Promise<Event> {
        return await this.getSingle<Event>("/events/ongoing")
    }

    async CreateEvent(event: Event): Promise<Number> {
        return await this.post("/events", event)
    }

    async SetEventStatus(event: Event): Promise<number> {
        if (event.users) {
            event.users = event.users.map((u: User) => {
                return {
                    id: u.id
                } as User
            })
        }
        return await this.put(`/events/setstatus/${event.id}`, event)
    }

    async EditEvent(event: Event): Promise<number> {
        return await this.put(`/events`, event)
    }

    async DeleteEvent(event_id: number): Promise<number> {
        return await this.delete(`/events/${event_id}`)
    }

    async GetAvailableTables(event_id: number): Promise<AvailableTable[]> {
        return await this.get<AvailableTable>(`/events/${event_id}/tables/available`)
    }

    async GetFreeTables(event_id: number): Promise<AvailableTable[]> {
        return await this.get<AvailableTable>(`/events/${event_id}/tables/free`)
    }

    async ChangeTable(table_id: number, master_table_id: number): Promise<number> {
        return await this.put<AvailableTable>(`/tables/${table_id}/change/${master_table_id}`, {} as AvailableTable)
    }

    async GetMasterTable(master_id: string): Promise<MasterTable> {
        return await this.getSingle<MasterTable>(`/master-tables/${master_id}`)
    }

    async GetTable(master_id: string): Promise<MasterTable> {
        return await this.getSingle<MasterTable>(`/tables/${master_id}`)
    }

    async GetOrdersInEvent(event_id: number, destinations_ids: string): Promise<Order[]> {
        return await this.get<Order>(`/orders/${event_id}/[${destinations_ids}]`)
    }

    async GetTablesInEvent(event_id: number): Promise<Table[]> {
        return await this.get<Table>(`/events/${event_id}/tables`)
    }

    async CreateOrder(order: Order): Promise<Number> {
        return await this.post("/orders", order)
    }

    async UpdateItem(item: Item): Promise<Number> {
        return await this.put("/items", item)
    }

    async CompleteOrder(order_id: number, input: CompleteOrderInput): Promise<Number> {
        return (await this.client.put(`/orders/${order_id}/complete`, input, this.config)).data
    }

    async CompleteTable(table_id: number): Promise<Number> {
        return (await this.client.put(`/tables/${table_id}/complete`, {}, this.config)).data
    }

    async PaySelectedItem(table_id: number, item_ids: number[]): Promise<number> {
        return (await this.client.put(`/tables/${table_id}/payitems`, item_ids, this.config)).data
    }

    async InsertDiscount(event_id: number, table_id: number, discount: number): Promise<number> {
        return (await this.client.post(`/events/${event_id}/tables/${table_id}/discount/${discount}`)).data
    }

    async DeleteItem(item_id: number) {
        return await this.delete(`/items/${item_id}`);
    }

    async GetAllMasterTables(): Promise<MasterTable[]> {
        return await this.get<MasterTable>("/master-tables");
    }

    async CreateMasterTables(masterTable: MasterTable): Promise<number> {
        return await this.post<MasterTable>("/master-tables", masterTable);
    }

    async EditMasterTables(masterTable: MasterItem): Promise<number> {
        return await this.put<MasterItem>("/master-tables", masterTable);
    }

    async GetAllMenu(): Promise<Menu[]> {
        return await this.get<MasterItem>(`/menu`);
    }

    async CreateMenu(menu: Menu): Promise<number> {
        return await this.post<Menu>("/menu", menu);
    }

    async EditMenu(menu: Menu): Promise<number> {
        return await this.put<Menu>("/menu", menu);
    }

    async DeleteMenu(id: number): Promise<number> {
        return await this.delete(`/menu/${id}`);
    }

    async GetAllMasterItems(menu_id: number): Promise<MasterItem[]> {
        return await this.get<MasterItem>(`/master-items/${menu_id}`);
    }

    async GetAvailableMasterItems(menu_id: number): Promise<MasterItem[]> {
        return await this.get<MasterItem>(`/master-items/available/${menu_id}`);
    }

    async CreateMasterItems(masterItem: MasterItem): Promise<number> {
        return await this.post<MasterItem>("/master-items", masterItem);
    }

    async EditMasterItems(masterItem: MasterItem): Promise<number> {
        return await this.put<MasterItem>("/master-items", masterItem);
    }

    async GetDestinations(): Promise<Destination[]> {
        return await this.get<Destination>("/destinations");
    }

    async CreateDestination(destination: Destination): Promise<number> {
        return await this.post<Destination>("/destinations", destination);
    }

    async EditDestination(destination: Destination): Promise<number> {
        return await this.put<Destination>("/destinations", destination);
    }

    async GetTypes(): Promise<Type[]> {
        return await this.get<Type>("/types")
    }

    async CreateType(type: Type): Promise<number> {
        return await this.post("/types", type)
    }

    async EditType(type: Type): Promise<number> {
        return await this.put("/types", type)
    }

    async DeleteType(id: number): Promise<number> {
        return await this.delete(`/types/${id}`)
    }

    async GetSubTypes(): Promise<SubType[]> {
        return await this.get<SubType>("/subtypes")
    }

    async CreateSubType(subtypes: SubType): Promise<number> {
        return await this.post("/subtypes", subtypes)
    }

    async EditSubType(subtypes: SubType): Promise<number> {
        return await this.put("/subtypes", subtypes)
    }

    async DeleteSubType(id: number): Promise<number> {
        return await this.delete(`/subtypes/${id}`)
    }

    async AskReset(email: string) {
        await this.client.post("/public/askreset", {
            email
        })
        this.snackbarStoreDef().show("Richiesta effettuata. Riceverai una mail con le istruzioni per reinpostare la tua password")
        router.push("/login")
    }

    async Reset(invitation: Invitation) {
        await this.client.post("/public/reset", invitation)
        this.snackbarStoreDef().show("Password reimpostata con successo", 3000, 'top', 'success')
        router.push("/login")
    }

    async GetUsers(): Promise<User[]> {
        return await this.get("/users")
    }

    async GetAudit(page: number, itemsPerPage: number, sortBy: string, sortDir: string): Promise<any> {
        return await this.get(`/audit?page=${page}&itemsperpage=${itemsPerPage}&sortby=${sortBy}&sortdir=${sortDir}`)
    }

    async GetUserAvatar(id: number) {
        return await this.get(`/users-public/avatar/${id}`)
    }

    async GetProfile(id: number): Promise<User> {
        return await this.getSingle<User>(`/profile/${id}`)
    }

    async EditProfileAvatar(formData: FormData, id: number): Promise<string> {
        const response: AxiosResponse<string> = await this.client.put(`/profile/avatar/${id}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
        return response.data
    }

    async EditProfileUsername(user: User): Promise<number> {
        return await this.put("/profile/username", user)
    }

    async BroadcastMessage(broadcast: Broadcast): Promise<number> {
        return await this.post("/broadcast", broadcast)
    }

    async GetAvailableUsers(): Promise<User[]> {
        return await this.get("/events/users")
    }

    async UpdateUser(user: User): Promise<number> {
        return await this.put("/users", user)
    }

    async UpdateUserRoles(user: User): Promise<number> {
        return await this.put("/users/roles", user)
    }

    async DeleteUser(user_id: number): Promise<number> {
        return await this.delete(`/users/${user_id}`)
    }

    async InviteUser(user: User): Promise<number> {
        return await this.post("/users/invite", user)
    }

    async AcceptInvitation(formData: FormData) {
        await this.client.post("/public/invitation/accept", formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })

        this.snackbarStoreDef().show("Invito accettato con successo", 3000, 'top', 'success')
        router.push("/login")
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

    async CheckAuthentication(): Promise<User> {
        return (await this.client.get<User>('/checkauthentication')).data
    }
}

