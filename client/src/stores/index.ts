import { defineStore, type StoreDefinition } from 'pinia'

export const UserStore:StoreDefinition = defineStore('user', {
    state: () => ({ isLoggedIn: 0 }),
    actions: {
        login() {
            this.isLoggedIn = 1
        },
        logout() {
            this.isLoggedIn = 0
        }
    },
})

export const SnackbarStore:StoreDefinition = defineStore('snackbar', {
    state: () => ({ show: false, text: '', timeout: 3000 }),
    actions: {
        showSnackBar(text: string, timeout: number = 3000) {
            this.show = true
            this.text = text
            this.timeout = timeout
        }
    },
})