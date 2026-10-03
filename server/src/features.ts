import type { Feature } from '../../models/src'

export type { Feature }

/**
 * Optional functions of an installation, switched on by the FEATURES environment variable
 * (comma separated). Unset means every function is on; an empty value means none.
 * A customisation for one client is always one of these, never code that checks the client's name.
 */
export const FEATURES = [
    /** Electronic payments (SumUp) at the checkout, and their admin page. */
    'payments',
    /** Web push notifications of new orders for bartenders. */
    'push',
    /** "Sign in with Google" (also needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). */
    'google-login',
    /** Staff-to-staff messages during an event. */
    'broadcast',
    /** Minimum consumption price of an event, chargeable instead of a product. */
    'minimum-consumption',
    /** PREMIUM version of a cocktail at a fixed price. */
    'premium',
] as const satisfies readonly Feature[]

/**
 * Functions active in a venue: the venue's own list (`venues.features`, JSON; NULL = all) within the installation's.
 * Unknown names in the stored list are ignored.
 */
export function venueFeatures(installation: ReadonlySet<Feature>, stored: unknown): Set<Feature> {
    const own = typeof stored === 'string' ? JSON.parse(stored) : stored
    if (!Array.isArray(own)) return new Set(installation)
    return new Set(FEATURES.filter(f => installation.has(f) && own.includes(f)))
}

export function parseFeatures(value: string | undefined): Set<Feature> {
    if (value === undefined) {
        return new Set(FEATURES)
    }
    const names = value.split(',').map(name => name.trim()).filter(Boolean)
    const unknown = names.filter(name => !(FEATURES as readonly string[]).includes(name))
    if (unknown.length) {
        // A typo would silently switch a function off: refuse to start instead
        throw new Error(`Unknown FEATURES: ${unknown.join(', ')}. Valid values: ${FEATURES.join(', ')}`)
    }
    return new Set(names as Feature[])
}
