import { randomUUID } from 'node:crypto'

/**
 * Sends an error message to Sentry through its envelope endpoint (no SDK in the backup image). Does nothing without a
 * DSN; never throws (an alert that fails must not hide the original error).
 */
export async function sentryAlert(dsn, message, { tags = {}, environment, fetchImpl = fetch } = {}) {
    if (!dsn) return false
    try {
        const { protocol, username: publicKey, host, pathname } = new URL(dsn)
        const projectId = pathname.replace(/^\//, '')
        const eventId = randomUUID().replace(/-/g, '')
        const event = {
            event_id: eventId, timestamp: Date.now() / 1000, level: 'error', platform: 'node', logger: 'backup',
            message: { formatted: message }, tags, environment,
        }
        const body = [JSON.stringify({ event_id: eventId, dsn }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n')
        const res = await fetchImpl(`${protocol}//${host}/api/${projectId}/envelope/`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-sentry-envelope', 'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${publicKey}` },
            body,
        })
        return res.ok
    } catch {
        return false
    }
}
