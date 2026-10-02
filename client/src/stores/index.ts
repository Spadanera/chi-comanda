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

export type ThemePreference = 'light' | 'dark' | 'auto'

const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'auto']
const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : undefined

function readThemePreference(): ThemePreference {
    const stored = readStorage('theme') as ThemePreference | null
    return stored && THEME_PREFERENCES.includes(stored) ? stored : 'auto'
}

/** Tema scelto dall'utente: chiaro, scuro o automatico (segue il dispositivo). */
export const ThemeStore = defineStore('theme', {
    state: () => ({
        preference: readThemePreference(),
        systemDark: darkQuery?.matches ?? false,
    }),
    getters: {
        /** Tema effettivo da passare a Vuetify. */
        theme: (state): 'light' | 'dark' => state.preference === 'auto'
            ? (state.systemDark ? 'dark' : 'light')
            : state.preference,
    },
    actions: {
        setPreference(preference: ThemePreference) {
            this.preference = preference
            writeStorage('theme', preference)
        },
        /** Aggiorna il tema quando il dispositivo passa da chiaro a scuro (solo in automatico). */
        watchSystem() {
            darkQuery?.addEventListener('change', event => { this.systemDark = event.matches })
        },
    },
})
