import fs from 'fs'
import path from 'path'
import { Feature, parseFeatures } from './features'

const env = process.env

const useStaging = env.MYSQL_ENV === 'STG'
const dbEnv = (name: string) => env[useStaging ? `${name}_STG` : name]

/** Version of the release, from the root package.json (`npm version` bumps it). */
function readVersion(): string {
    try {
        return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')).version
    } catch {
        return 'unknown'
    }
}

/**
 * A deployed installation (not local development): strict session cookie and required configuration.
 * Railway sets RAILWAY_ENVIRONMENT on every deploy, so NODE_ENV doesn't need to be set there (as a build-time
 * variable it would also make `npm install` skip the devDependencies the build needs).
 */
const deployed = env.NODE_ENV === 'production' || !!env.RAILWAY_ENVIRONMENT

const config = {
    deployed,
    app: {
        version: readVersion(),
        /** Set by Railway on every deploy. */
        commit: (env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7),
        environment: env.SENTRY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME || env.NODE_ENV || 'development',
    },
    /** Error reporting, off unless the DSNs are set. The client one is sent to the browser via /api/public/config. */
    sentry: {
        dsn: env.SENTRY_DSN || '',
        clientDsn: env.SENTRY_CLIENT_DSN || '',
    },
    /** Identity of the installation: one deploy per client, all from the same code. */
    client: {
        name: env.CLIENT_NAME || '',
        slug: env.CLIENT_SLUG || '',
    },
    features: parseFeatures(env.FEATURES),
    port: +(env.PORT || 3000),
    baseUrl: env.BASE_URL || '',
    sessionSecret: env.SECRET || '',
    sessionCookieName: 'lp-session',
    sessionMaxAgeMs: 1000 * 60 * 60 * 24 * 30,
    /** Invitation and password-reset links expire after this many hours. */
    tokenTtlHours: 24,
    db: {
        host: dbEnv('MYSQL_HOST'),
        port: parseInt(dbEnv('MYSQL_PORT') || '3306'),
        user: dbEnv('MYSQL_USER'),
        password: dbEnv('MYSQL_PASSWORD'),
        database: dbEnv('MYSQL_DATABASE'),
    },
    /** Fills a freshly created database with demo rooms, tables and products. Local development and tests only. */
    demoSeed: env.DEMO_SEED === 'true',
    google: {
        clientId: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    },
    /** Web push (VAPID). Without both keys push notifications are disabled. */
    push: {
        publicKey: env.VAPID_PUBLIC_KEY || '',
        privateKey: env.VAPID_PRIVATE_KEY || '',
        subject: env.VAPID_SUBJECT || `mailto:${env.MAIL_FROM || 'info@chicomanda.com'}`,
    },
    mail: {
        apiKey: env.MAIL_API_KEY || '',
        apiSecret: env.MAIL_API_SECRET || '',
        from: env.MAIL_FROM || '',
        fromName: env.MAIL_FROM_NAME || '',
    },
}

/** Configuration problems that must stop a deployed installation from starting. */
export function configErrors(c: { deployed: boolean, sessionSecret: string, baseUrl: string }): string[] {
    if (!c.deployed) return []
    const errors: string[] = []
    if (!c.sessionSecret) errors.push('SECRET is not set: sessions and payment callbacks would not be secure')
    if (!c.baseUrl) {
        errors.push('BASE_URL is not set: links in e-mails and the Google login callback would be wrong')
    } else if (!/^https?:\/\/[^/]+/.test(c.baseUrl)) {
        errors.push(`BASE_URL is not a URL: ${c.baseUrl}`)
    }
    return errors
}

if (!config.deployed && !config.sessionSecret) {
    console.warn('SECRET is not set: sessions and payment callbacks are not secure')
}

export function isFeatureEnabled(feature: Feature): boolean {
    return config.features.has(feature)
}

export default config
