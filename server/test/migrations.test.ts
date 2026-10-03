import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import mysql, { RowDataPacket } from 'mysql2/promise'
import { afterAll, describe, expect, it } from 'vitest'
import { DEMO_SEED_FILE, MIGRATIONS_DIR, listMigrations, migrate } from '../src/db/migrate'
import { TEST_DB } from './db-env'

const silent = () => undefined
const scratchDbs: string[] = []

function rootConnection(database?: string) {
    return mysql.createConnection({
        host: TEST_DB.host, port: TEST_DB.port, user: 'root', password: TEST_DB.rootPassword,
        database, multipleStatements: true, decimalNumbers: true,
    })
}

/** A new empty database on the test server; returns the options to migrate it. */
async function scratchDb(name: string) {
    const database = `migtest_${name}`
    const conn = await rootConnection()
    await conn.query(`DROP DATABASE IF EXISTS ${database}`)
    await conn.query(`CREATE DATABASE ${database}`)
    await conn.end()
    scratchDbs.push(database)
    return { host: TEST_DB.host, port: TEST_DB.port, user: 'root', password: TEST_DB.rootPassword, database }
}

async function query(database: string, sql: string, params: unknown[] = []) {
    const conn = await rootConnection(database)
    try {
        const [rows] = await conn.query<RowDataPacket[]>(sql, params)
        return rows
    } finally {
        await conn.end()
    }
}

async function columnType(database: string, table: string, column: string) {
    const [row] = await query(database,
        'SELECT column_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
        [database, table, column])
    return row?.COLUMN_TYPE ?? row?.column_type
}

/** Every column of every table, to compare two schemas. */
async function schemaOf(database: string) {
    return query(database, `
        SELECT table_name t, column_name c, column_type ty, is_nullable n, column_default d, column_key k
        FROM information_schema.columns WHERE table_schema = ? ORDER BY table_name, ordinal_position`, [database])
}

async function appliedVersions(database: string) {
    return (await query(database, 'SELECT version, executed FROM schema_migrations ORDER BY version'))
        .map(r => [r.version, r.executed])
}

/** A copy of the real migrations plus `extra` files, in a temporary directory. */
async function migrationsDirWith(extra: Record<string, string>) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'migrations-'))
    for (const name of await fs.readdir(MIGRATIONS_DIR)) {
        await fs.copyFile(path.join(MIGRATIONS_DIR, name), path.join(dir, name))
    }
    for (const [name, sql] of Object.entries(extra)) {
        await fs.writeFile(path.join(dir, name), sql)
    }
    return dir
}

const allVersions = async () => (await listMigrations()).map(m => m.version)

afterAll(async () => {
    const conn = await rootConnection()
    for (const database of scratchDbs) await conn.query(`DROP DATABASE IF EXISTS ${database}`)
    await conn.end()
})

describe('migrations', () => {
    it('creates the full schema and the generic seed on an empty database', async () => {
        const db = await scratchDb('empty')
        const result = await migrate({ db, log: silent })

        expect(result).toEqual({ applied: await allVersions(), baselineRecorded: false })
        expect(await appliedVersions(db.database)).toEqual((await allVersions()).map(v => [v, 1]))
        expect((await query(db.database, 'SELECT name FROM roles ORDER BY id')).map(r => r.name))
            .toEqual(['admin', 'checkout', 'waiter', 'bartender', 'superuser', 'client'])
        expect(await query(db.database, 'SELECT name FROM menu')).toEqual([{ name: 'Menu Principale' }])
        // No client-specific data on a new installation
        expect(await query(db.database, 'SELECT id FROM users')).toEqual([])
        expect(await query(db.database, 'SELECT id FROM master_items')).toEqual([])
        expect(await columnType(db.database, 'items', 'price')).toBe('decimal(10,2)')
        expect(await columnType(db.database, 'reset', 'creation_date')).toBe('datetime')
    })

    it('adds the demo data only when asked', async () => {
        const db = await scratchDb('demo')
        await migrate({ db, demoSeedFile: DEMO_SEED_FILE, log: silent })

        expect((await query(db.database, 'SELECT COUNT(*) n FROM master_items'))[0].n).toBeGreaterThan(0)
        expect((await query(db.database, 'SELECT COUNT(*) n FROM master_tables'))[0].n).toBe(21)
    })

    it('on a database with the production schema records the baseline and applies only the new migrations', async () => {
        const db = await scratchDb('production')
        // The baseline file is the production schema: load it as an existing installation would have it
        const conn = await rootConnection(db.database)
        await conn.query(await fs.readFile(path.join(MIGRATIONS_DIR, '001_baseline.sql'), 'utf8'))
        await conn.query(`INSERT INTO users (email, creation_date) VALUES ('old@test.local', '2026-10-01')`)
        await conn.query(`INSERT INTO items_history (id, name, price) VALUES (1, 'Sconto', -0.9000000000000004)`)
        await conn.end()

        const result = await migrate({ db, demoSeedFile: DEMO_SEED_FILE, log: silent })

        expect(result.baselineRecorded).toBe(true)
        expect(result.applied).toEqual((await allVersions()).filter(v => v > 1))
        expect((await appliedVersions(db.database))[0]).toEqual([1, 0])
        // Neither the baseline seed nor the demo seed ran again
        expect((await query(db.database, 'SELECT COUNT(*) n FROM roles'))[0].n).toBe(6)
        expect((await query(db.database, 'SELECT COUNT(*) n FROM master_items'))[0].n).toBe(0)
        // Data kept, types widened
        const [user] = await query(db.database, `SELECT DATE_FORMAT(creation_date, '%Y-%m-%d %H:%i') d FROM users`)
        expect(user.d).toBe('2026-10-01 00:00')
        expect(await query(db.database, 'SELECT price FROM items_history')).toEqual([{ price: -0.9 }])

        // Same schema as a database created from scratch
        const fresh = await scratchDb('fresh')
        await migrate({ db: fresh, log: silent })
        expect(await schemaOf(db.database)).toEqual(await schemaOf(fresh.database))
    })

    it('does nothing on the second run', async () => {
        const db = await scratchDb('twice')
        await migrate({ db, log: silent })
        const before = await appliedVersions(db.database)

        expect(await migrate({ db, log: silent })).toEqual({ applied: [], baselineRecorded: false })
        expect(await appliedVersions(db.database)).toEqual(before)
    })

    it('stops at a failing migration without recording it', async () => {
        const db = await scratchDb('failing')
        const dir = await migrationsDirWith({
            '900_good.sql': 'ALTER TABLE `users` ADD COLUMN `x900` INT NULL;',
            '901_broken.sql': 'ALTER TABLE `no_such_table` ADD COLUMN `y` INT NULL;',
            '902_after.sql': 'ALTER TABLE `users` ADD COLUMN `x902` INT NULL;',
        })

        await expect(migrate({ db, dir, log: silent })).rejects.toThrow(/901_broken\.sql failed/)
        const versions = (await appliedVersions(db.database)).map(([v]) => v)
        expect(versions).toContain(900)
        expect(versions).not.toContain(901)
        expect(versions).not.toContain(902)

        // Once fixed, the next start resumes from the failed one
        await fs.writeFile(path.join(dir, '901_broken.sql'), 'ALTER TABLE `users` ADD COLUMN `y` INT NULL;')
        expect((await migrate({ db, dir, log: silent })).applied).toEqual([901, 902])
        await fs.rm(dir, { recursive: true })
    })

    it('applies each migration once when two servers start together', async () => {
        const db = await scratchDb('parallel')
        const results = await Promise.all([migrate({ db, log: silent }), migrate({ db, log: silent })])

        expect(results.flatMap(r => r.applied).sort((a, b) => a - b)).toEqual(await allVersions())
        expect(await appliedVersions(db.database)).toEqual((await allVersions()).map(v => [v, 1]))
    })

    it('starts on a database migrated by a newer release (rollback)', async () => {
        const db = await scratchDb('rollback')
        await migrate({ db, log: silent })
        await query(db.database, `INSERT INTO schema_migrations (version, name, executed) VALUES (999, '999_future.sql', 1)`)
        const messages: string[] = []

        expect(await migrate({ db, log: m => messages.push(m) })).toEqual({ applied: [], baselineRecorded: false })
        expect(messages.join('\n')).toMatch(/does not know: 999/)
    })

    it('rejects two migrations with the same version', async () => {
        const dir = await migrationsDirWith({ '002_duplicate.sql': 'SELECT 1;' })
        await expect(listMigrations(dir)).rejects.toThrow(/Two migrations with version 2/)
        await fs.rm(dir, { recursive: true })
    })
})
