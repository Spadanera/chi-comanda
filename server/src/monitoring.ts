import * as Sentry from '@sentry/node'
import config from './config'

/** Optional Sentry: everything here is a no-op unless SENTRY_DSN is set. */

const enabled = () => !!config.sentry.dsn

export function initMonitoring() {
    if (!enabled()) return
    Sentry.init({
        dsn: config.sentry.dsn,
        release: config.app.version,
        environment: config.app.environment,
        // Errors only: no performance tracing. Sentry 11 collects everything by default
        // (users, cookies, headers, bodies, local variables): opt out explicitly.
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
            databaseQueryData: false,
            stackFrameVariables: false,
        },
        initialScope: { tags: { client: config.client.slug || config.client.name || 'unknown' } },
    })
}

export function captureError(error: unknown) {
    if (enabled()) Sentry.captureException(error)
}

/** Before exiting: errors are sent asynchronously. */
export async function flushMonitoring() {
    if (enabled()) await Sentry.flush(2000)
}
