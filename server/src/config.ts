const env = process.env

const useStaging = env.MYSQL_ENV === 'STG'
const dbEnv = (name: string) => env[useStaging ? `${name}_STG` : name]

const config = {
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

if (!config.sessionSecret) {
    console.warn('SECRET is not set: sessions and payment callbacks are not secure')
}

export default config
