import { defineStore, type StateTree, type StoreDefinition } from 'pinia'
import Axios from "../services/client"
import { type Role } from "../../../models/src"
import router from '@/router'

export interface IUser {
    id?: number,
    username?: string,
    email?: string,
    roles: Role[]
    isLoggedIn: boolean
}

export const UserStore: StoreDefinition = defineStore('user', {
    state: () => {
        return {
            id: 0,
            username: '',
            email: '',
            password: '',
            roles: [],
            isLoggedIn: false
        } as IUser
    },
    getters: {
        user: (state: any) => {
            return {
                id: state.id,
                username: state.username,
                email: state.email,
                roles: state.roles,
                isLoggedIn: state.isLoggedIn
            }
        },
    },
    actions: {
        setUser(user: IUser, isLoggedIn: boolean) {
            this.id = user.id
            this.username = user.username
            this.email = user.email
            this.roles = user.roles
            this.isLoggedIn = isLoggedIn
        },
        login(user: IUser) {
            this.setUser(user, true)
        },
        logout() {
            this.setUser({} as IUser, false)
        },
        async checkAuthentication() {
            const axios: Axios = new Axios()
            const user = await axios.CheckAuthentication()
            if (user.username) {
                this.login(user)
                return {
                    id: this.id,
                    username: this.username,
                    email: this.email,
                    roles: this.roles,
                    isLoggedIn: true
                }
            }
            else {
                this.logout()
                return {}
            }
        }
    },
})

export const SnackbarStore: StoreDefinition = defineStore('snackbar', {
    state: () => ({ enable: false, text: '', timeout: 3000, location: 'bottom' }),
    actions: {
        show(text: string, timeout: number = 3000, location: string = 'bottom') {
            this.enable = true
            this.text = text
            this.timeout = timeout
            this.location = location
        }
    },
})