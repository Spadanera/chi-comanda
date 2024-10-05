import { defineStore, type StateTree, type StoreDefinition } from 'pinia'
import Axios from "../services/client"
import { type User } from "../../../models/src"

interface IUser extends User {
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
    actions: {
        setUser(user: User, isLoggedIn: boolean) {
            this.id = user.id
            this.username = user.username
            this.email = user.email
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
            this.setUser(user, user.username ? true : false)
        }
    },
})

export const SnackbarStore: StoreDefinition = defineStore('snackbar', {
    state: () => ({ show: false, text: '', timeout: 3000 }),
    actions: {
        showSnackBar(text: string, timeout: number = 3000) {
            this.show = true
            this.text = text
            this.timeout = timeout
        }
    },
})