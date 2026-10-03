import fs from 'fs/promises'
import path from 'path'
import mysql, { Connection, ConnectionOptions, RowDataPacket } from 'mysql2/promise'

/**
 * Versioned schema migrations: `server/migrations/NNN_name.sql`, applied in order at startup, before the server
 * accepts requests, and recorded in `schema_migrations`.
 *
 * Rules (see docs): a migration may only need the code of the previous release (add columns and tables, widen types;
 * no renames or drops in the same release), so a rollback is just redeploying the previous version. MySQL commits
 * every DDL statement on its own, so a migration that fails halfway is not rolled back: keep each file small.
 */

export const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations')
export const DEMO_SEED_FILE = path.resolve(__dirname, '../../seeds/demo.sql')

const BASELINE_VERSION = 1
const FILE_PATTERN = /^(\d{3})_[\w-]+\.sql$/
const LOCK_TIMEOUT_SECONDS = 120

export interface MigrateOptions {
    db: ConnectionOptions
    dir?: string
    /** SQL file applied once, right after the baseline has created an empty database (dev and tests only). */
    demoSeedFile?: string
    log?: (message: string) => void
}

export interface MigrateResult {
    /** Versions executed by this run. */
    applied: number[]
    /** True when the baseline was only recorded, because the database already had the schema. */
    baselineRecorded: boolean
}

interface Migration {
    version: number
    name: string
    file: string
}

export async function listMigrations(dir: string = MIGRATIONS_DIR): Promise<Migration[]> {
    const migrations = (await fs.readdir(dir))
        .filter(name => FILE_PATTERN.test(name))
        .map(name => ({ version: Number(name.slice(0, 3)), name, file: path.join(dir, name) }))
        .sort((a, b) => a.version - b.version)
    migrations.forEach((m, i) => {
        if (i > 0 && m.version === migrations[i - 1].version) {
            throw new Error(`Two migrations with version ${m.version}: ${migrations[i - 1].name}, ${m.name}`)
        }
    })
    if (migrations[0]?.version !== BASELINE_VERSION) {
        throw new Error(`Migration ${BASELINE_VERSION} (baseline) is missing in ${dir}`)
    }
    return migrations
}

async function tableExists(conn: Connection, table: string): Promise<boolean> {
    const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table])
    return rows.length > 0
}

async function runFile(conn: Connection, file: string) {
    await conn.query(await fs.readFile(file, 'utf8'))
}

export async function migrate(options: MigrateOptions): Promise<MigrateResult> {
    const log = options.log ?? (message => console.log(`[migrations] ${message}`))
    const migrations = await listMigrations(options.dir)
    const conn = await mysql.createConnection({ ...options.db, multipleStatements: true })
    const lockName = `chi-comanda-migrations:${options.db.database}`
    try {
        const [[lock]] = await conn.query<RowDataPacket[]>('SELECT GET_LOCK(?, ?) AS acquired', [lockName, LOCK_TIMEOUT_SECONDS])
        if (lock.acquired !== 1) {
            throw new Error(`Could not acquire the migration lock within ${LOCK_TIMEOUT_SECONDS}s`)
        }
        try {
            await conn.query(`
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INT NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    executed TINYINT(1) NOT NULL,
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )`)
            const [rows] = await conn.query<RowDataPacket[]>('SELECT version FROM schema_migrations')
            const done = new Set(rows.map(r => r.version as number))
            const result: MigrateResult = { applied: [], baselineRecorded: false }

            // A database created before migrations existed (init.sql / release.sql): the baseline is its schema.
            if (!done.has(BASELINE_VERSION) && await tableExists(conn, 'users')) {
                await conn.query('INSERT INTO schema_migrations (version, name, executed) VALUES (?, ?, 0)',
                    [BASELINE_VERSION, migrations[0].name])
                done.add(BASELINE_VERSION)
                result.baselineRecorded = true
                log(`${migrations[0].name}: existing schema, recorded as applied`)
            }

            for (const migration of migrations.filter(m => !done.has(m.version))) {
                log(`${migration.name}: applying`)
                try {
                    await runFile(conn, migration.file)
                } catch (error) {
                    throw new Error(`Migration ${migration.name} failed: ${(error as Error).message}`)
                }
                await conn.query('INSERT INTO schema_migrations (version, name, executed) VALUES (?, ?, 1)',
                    [migration.version, migration.name])
                result.applied.push(migration.version)

                if (migration.version === BASELINE_VERSION && options.demoSeedFile) {
                    log('demo seed: applying')
                    await runFile(conn, options.demoSeedFile)
                }
            }

            const known = new Set(migrations.map(m => m.version))
            const unknown = [...done].filter(v => !known.has(v))
            if (unknown.length) {
                // Expected after a rollback: the previous release runs on the newer (additive) schema
                log(`database has migrations this release does not know: ${unknown.join(', ')}`)
            }
            if (!result.applied.length) log('schema up to date')
            return result
        } finally {
            // Must not hide the original error; the lock goes away with the connection anyway
            await conn.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined)
        }
    } finally {
        await conn.end()
    }
}

