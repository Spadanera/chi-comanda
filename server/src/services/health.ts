import db from '../db'
import config from '../config'

const DB_TIMEOUT_MS = 3000

export interface Health {
    status: 'ok' | 'error'
    version: string
    commit: string | null
    client: string | null
    db: 'ok' | 'unreachable'
    /** Last migration applied to the database. */
    migration: string | null
}

/** For the platform healthcheck (Railway sends traffic to a new deploy only once this answers 200). */
export async function checkHealth(): Promise<Health> {
    const base = { version: config.app.version, commit: config.app.commit || null, client: config.client.slug || null }
    let timer: NodeJS.Timeout | undefined
    try {
        const row = await Promise.race([
            db.queryOne<{ name: string }>('SELECT name FROM schema_migrations ORDER BY version DESC LIMIT 1'),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Database timeout')), DB_TIMEOUT_MS) }),
        ])
        return { status: 'ok', ...base, db: 'ok', migration: row?.name ?? null }
    } catch (error) {
        console.error('Health check: database unreachable', (error as Error).message)
        return { status: 'error', ...base, db: 'unreachable', migration: null }
    } finally {
        clearTimeout(timer)
    }
}
