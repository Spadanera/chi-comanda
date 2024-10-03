import axios, { type AxiosResponse, type AxiosRequestConfig, type RawAxiosRequestHeaders, type AxiosInstance } from 'axios'



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
    }

    private get(url: string) {

    }
}

