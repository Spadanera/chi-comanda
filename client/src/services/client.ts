import axios, { type AxiosResponse, type AxiosRequestConfig, type RawAxiosRequestHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { type Repository, type User, type Event } from "../../../models/src"
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
                  snackbar.showSnackBar("Si è verificare un errore")
                }
              }
              return Promise.reject(error)
        })

        this.userStoreDef = UserStore
        this.snackbarStoreDef = SnackbarStore
    }

    private async get<T extends Repository>(path: string): Promise<T> {
        const response: AxiosResponse<T> = await this.client.get<T>(path, this.config)
        return response.data
    }

    private async post<T extends Repository>(path: string, body: T): Promise<number> {
        const response: AxiosResponse<number> = await this.client.post(path, body, this.config)
        return response.data
    }

    async GetAllEvents(): Promise<Event[]> {
        const response: AxiosResponse<Event[]> = await this.client.get<Event[]>("/events", this.config)
        return response.data
    }

    async CreateEvent(event: Event): Promise<Number> {
        return await this.post("/events", event)
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
        this.snackbarStoreDef().showSnackBar("Logout effettuato con successo")
    }

    async CheckAuthentication(): Promise<IUser> {
        return (await this.client.get<IUser>('/checkauthentication')).data
    }
}

