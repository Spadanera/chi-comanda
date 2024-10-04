import axios, { type AxiosResponse, type AxiosRequestConfig, type RawAxiosRequestHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { type Repository } from "../../../models/src"
import router from '@/router'

export default class Client {
    client: AxiosInstance
    config: AxiosRequestConfig = {
        headers: {
            'Content-Type': 'application/json'
        } as RawAxiosRequestHeaders,
    }

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
                  alert('An error occurred. Please try again later.')
                }
              }
              return Promise.reject(error)
        })
    }

    private async get<T extends Repository>(path: string): Promise<T> {
        const response: AxiosResponse<T> = await this.client.get(path, this.config)
        return response.data
    }

    private async post<T extends Repository>(path: string, body: T): Promise<number> {
        const response: AxiosResponse<number> = await this.client.post(path, body, this.config)
        return response.data
    }

    async GetAllEvents(): Promise<Event[]> {
        return await this.get<Event[]>("/events")
    }

    async CreateEvent(event: Event): Promise<Number> {
        return await this.post("/events", event)
    }
}

