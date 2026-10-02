import { defineStore } from 'pinia'
import api from '@/services/client'
import type { User } from '../../../models/src'

export interface SessionUser {
    id: number
    username: string
    email: string
    roles: string[]
    avatar: string
    isLoggedIn: boolean
}

const anonymous = (): SessionUser => ({ id: 0, username: '', email: '', roles: [], avatar: '', isLoggedIn: false })

function readStorage(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function writeStorage(key: string, value: string) {
    try {
        localStorage.setItem(key, value)
    } catch {
        // storage unavailable (private mode): the preference just won't persist
    }
}

export const UserStore = defineStore('user', {
    state: anonymous,
    getters: {
        user: (state): SessionUser => ({ ...state, roles: [...state.roles] }),
    },
    actions: {
        setUsername(username: string) {
            this.username = username
        },
        setAvatar(avatar: string) {
            this.avatar = avatar
        },
        login(user: User) {
            this.$patch({
                id: user.id || 0,
                username: user.username || '',
                email: user.email || '',
                avatar: user.avatar || '',
                roles: user.roles || [],
                isLoggedIn: true,
            })
        },
        logout() {
            this.$patch(anonymous())
        },
        /** Syncs the store with the server session and returns the current user. */
        async checkAuthentication(): Promise<SessionUser> {
            const user = await api.CheckAuthentication()
            if (user && user.username) {
                this.login(user)
            } else {
                this.logout()
            }
            return this.user
        },
    },
})

type SnackbarLocation = 'top' | 'bottom'

export const SnackbarStore = defineStore('snackbar', {
    state: () => ({ enable: false, text: '', timeout: 3000, location: 'bottom' as SnackbarLocation, color: 'default', reload: false }),
    actions: {
        /** `timeout: -1` keeps the snackbar open; `reload` shows a reload button. */
        show(text: string, timeout = 3000, location: SnackbarLocation | string = 'bottom', color = 'default', reload = false) {
            this.$patch({ enable: true, text, timeout, location: location as SnackbarLocation, color, reload })
        },
    },
})

export const ProgressStore = defineStore('progress', {
    state: () => ({ loading: false, activeRequestCount: 0 }),
})

export const ZoomStore = defineStore('zoom', {
    state: () => ({
        level: Number(readStorage('zoom_level')) || 1,
    }),
    actions: {
        setLevel(val: number) {
            this.level = val
            writeStorage('zoom_level', val.toString())
        },
    },
})

export const ThemeStore = defineStore('theme', {
    state: () => ({ theme: readStorage('theme') || 'light' }),
    actions: {
        toggle() {
            this.theme = this.theme === 'light' ? 'dark' : 'light'
            writeStorage('theme', this.theme)
        },
    },
})
