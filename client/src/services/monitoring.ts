import { ApiError } from './client'

/**
 * `beforeSend` of the browser's Sentry: drops what is not a bug of the app. An `ApiError` below 500 is a network
 * failure (status 0: very common on the waiters' phones, handled by the retries and the offline queue) or an answer
 * the user has already seen (wrong password, closed table…); the server reports its own 5xx.
 */
export function dropExpectedErrors<T>(event: T, hint?: { originalException?: unknown }): T | null {
    const error = hint?.originalException
    if (error instanceof ApiError && error.status < 500) return null
    return event
}
