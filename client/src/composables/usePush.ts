import { computed, ref } from 'vue'
import api from '@/services/client'
import { isFeatureEnabled } from '@/composables/useConfig'

/**
 * Web push notifications of new orders, for bartenders.
 * The preference is per user (null = never asked); the subscription is per device/browser.
 */

export const pushSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const isIOS = typeof navigator !== 'undefined'
    && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const isInstalled = typeof window !== 'undefined'
    && (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

const DISMISSED_KEY = 'push-dismissed-on-device'

const serverEnabled = ref(false)
let publicKey: string | null = null
/** User preference: undefined = not loaded yet, null = never asked. */
export const pushPreference = ref<boolean | null | undefined>(undefined)
export const deviceSubscribed = ref(false)
export const pushPermission = ref<NotificationPermission>(pushSupported ? Notification.permission : 'denied')

export type PushStatus = 'hidden' | 'unsupported' | 'needs-install' | 'denied' | 'on' | 'off'

/** What the profile page shows for this device. */
export const pushStatus = computed<PushStatus>(() => {
    if (!serverEnabled.value) return 'hidden'
    if (!pushSupported) return isIOS && !isInstalled ? 'needs-install' : 'unsupported'
    if (pushPermission.value === 'denied') return 'denied'
    return pushPreference.value === true && deviceSubscribed.value ? 'on' : 'off'
})

/** Rejects when the browser's push service doesn't answer (no network, service unreachable). */
function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
    return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Push service timeout')), ms))])
}

function registration(): Promise<ServiceWorkerRegistration> {
    // Returns the existing registration when the worker is already installed
    return navigator.serviceWorker.register('/sw.js')
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

function readDismissed(): boolean {
    try { return localStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
}

/** Loads server configuration, user preference and the state of this device. */
export async function loadPushState(): Promise<void> {
    // Switched off on this installation: its routes don't exist, don't ask
    if (!isFeatureEnabled('push')) {
        serverEnabled.value = false
        return
    }
    const config = await api.GetPushConfig()
    serverEnabled.value = config.enabled
    publicKey = config.publicKey
    if (!config.enabled || !pushSupported) return
    pushPermission.value = Notification.permission
    pushPreference.value = await api.GetPushPreference()
    const subscription = await (await registration()).pushManager.getSubscription()
    deviceSubscribed.value = !!subscription
}

/** Asks the browser for permission (native popup) and subscribes this device. */
export async function enablePush(): Promise<'on' | 'denied'> {
    const permission = await Notification.requestPermission()
    pushPermission.value = permission
    if (permission !== 'granted' || !publicKey) return 'denied'
    const reg = await registration()
    await withTimeout(navigator.serviceWorker.ready)
    const subscription = await reg.pushManager.getSubscription()
        ?? await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource }))
    await api.SavePushSubscription(subscription.toJSON())
    pushPreference.value = true
    deviceSubscribed.value = true
    return 'on'
}

/** Turns notifications off for the user, on every device. */
export async function disablePush(): Promise<void> {
    const subscription = await (await registration()).pushManager.getSubscription()
    await subscription?.unsubscribe()
    await api.SetPushPreference(false)
    pushPreference.value = false
    deviceSubscribed.value = false
}

/** "No thanks" on the first request: don't ask again. */
export async function declinePush(): Promise<void> {
    await api.SetPushPreference(false)
    pushPreference.value = false
}

/** "Not now" on a new device of a user who already has them on: don't ask again on this device. */
export function dismissOnThisDevice() {
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* private mode: asked again next time */ }
}

/**
 * What to do when a bartender opens the app:
 * - 'ask-first': never asked, show the explanation then the native popup
 * - 'ask-device': notifications on, but not on this device yet
 * - 'resubscribe': on, and the browser already allows them: subscribe silently
 */
export function nextPushStep(): 'ask-first' | 'ask-device' | 'resubscribe' | 'none' {
    if (!serverEnabled.value || !pushSupported || pushPermission.value === 'denied') return 'none'
    if (pushPreference.value === null) return 'ask-first'
    if (pushPreference.value === true && !deviceSubscribed.value) {
        if (pushPermission.value === 'granted') return 'resubscribe'
        return readDismissed() ? 'none' : 'ask-device'
    }
    return 'none'
}
