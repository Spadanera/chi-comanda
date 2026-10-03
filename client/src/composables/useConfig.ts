import { computed, ref, type ComputedRef } from 'vue'
import type { Feature, PublicConfig } from '../../../models/src'

/**
 * Configuration of this installation (venue name, active functions, branding), read once at startup
 * from /api/public/config. Never branch on the venue name: ask `useFeature` instead.
 */

const ALL_FEATURES: Feature[] = ['payments', 'push', 'google-login', 'broadcast', 'minimum-consumption', 'premium']

export const DEFAULT_NAME = 'Chi Comanda'

export const appConfig = ref<PublicConfig>({
    name: null,
    slug: null,
    // If the configuration can't be read the app keeps working as it always did
    features: ALL_FEATURES,
    logo: null,
    colors: { primary: null, secondary: null },
})

/** Name shown in the app bar, the title and the login page. */
export const venueName = computed(() => appConfig.value.name || DEFAULT_NAME)

export function isFeatureEnabled(feature: Feature): boolean {
    return appConfig.value.features.includes(feature)
}

export function useFeature(feature: Feature): ComputedRef<boolean> {
    return computed(() => isFeatureEnabled(feature))
}

/**
 * Plain fetch, not the API client: it runs before the app (and its stores) exist,
 * and a failure must not show errors, only fall back to the defaults.
 */
export async function loadConfig(): Promise<void> {
    try {
        const response = await fetch('/api/public/config', { credentials: 'same-origin' })
        if (response.ok) appConfig.value = await response.json()
    } catch (error) {
        console.error('Configuration not available, using the defaults', error)
    }
    applyDocumentBranding()
}

export function setConfig(config: PublicConfig) {
    appConfig.value = config
    applyDocumentBranding()
}

function setLink(rel: string, href: string) {
    document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`).forEach(link => {
        // Remember the default, to restore it when the logo is removed
        link.dataset.default ??= link.getAttribute('href') || ''
        link.href = href || link.dataset.default
    })
}

/** Tab title and icons follow the venue. */
function applyDocumentBranding() {
    document.title = venueName.value
    setLink('icon', appConfig.value.logo || '')
    setLink('apple-touch-icon', appConfig.value.logo || '')
}

/** Readable text colour on a background: black or white, by luminance. */
export function onColor(hex: string): string {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000000' : '#FFFFFF'
}

/** The same colour, 15% darker (Vuetify's `-darken-1` variant). */
export function darken(hex: string): string {
    return '#' + [1, 3, 5]
        .map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.85).toString(16).padStart(2, '0'))
        .join('').toUpperCase()
}
