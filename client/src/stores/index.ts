import { defineStore, type StoreDefinition } from 'pinia'
import Axios from "../services/client"
import type { User } from '../../../models/src'

export const UserStore: StoreDefinition = defineStore('user', {
    state: () => {
        return {
            id: 0,
            username: '',
            email: '',
            password: '',
            roles: [],
            isLoggedIn: false,
            avatar: ''
        } as User
    },
    getters: {
        user: (state: any) => {
            return {
                id: state.id,
                username: state.username,
                email: state.email,
                roles: state.roles,
                isLoggedIn: state.isLoggedIn,
                avatar: state.avatar
            }
        },
    },
    actions: {
        setUsername(username: string) {
            this.username = username
        },
        setAvatar(avatar: string) {
            this.avatar = avatar
        },
        setUser(user: User, isLoggedIn: boolean) {
            this.id = user.id
            this.username = user.username
            this.email = user.email
            this.avatar = user.avatar
            this.roles = user.roles
            this.isLoggedIn = isLoggedIn
        },
        login(user: User) {
            this.setUser(user, true)
        },
        logout() {
            this.setUser({} as User, false)
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
                    avatar: this.avatar,
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
    state: () => ({ enable: false, text: '', timeout: 3000, location: 'bottom', color: 'default', reload: false }),
    actions: {
        show(text: string, timeout: number = 3000, location: string = 'bottom', color: string = 'default', reload: boolean = false) {
            this.enable = true
            this.text = text
            this.timeout = timeout
            this.location = location
            this.color = color
            this.reload = reload
        }
    },
})

export const ProgressStore: StoreDefinition = defineStore('progress', {
    state: () => ({ loading: false, activeRequestCount: 0 })
})

export const ThemeStore: StoreDefinition = defineStore('theme', {
    state: () => ({ theme: localStorage.getItem('theme') || 'light' }),
    actions: {
        toggle() {
            this.theme = this.theme === 'light' ? 'dark' : 'light'
            this.persistToLocalStorage()
        },
        persistToLocalStorage() {
            localStorage.setItem("theme", this.theme);
        }
    },

})