import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import mysql, { RowDataPacket } from 'mysql2/promise'
import { afterAll, describe, expect, it } from 'vitest'
import { DEMO_SEED_FILE, MIGRATIONS_DIR, listMigrations, migrate } from '../src/db/migrate'
import { TEST_DB } from './db-env'
import { VENUE_TABLES } from '../src/venue/db'

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

/** Tables shared by every venue of the installation; any other table belongs to a venue. */
const GLOBAL_TABLES = ['users', 'roles', 'sessions', 'reset', 'push_subscriptions', 'schema_migrations', 'venues', 'settings']

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
        // Branding saved by a release with 004 (idempotent, it runs again), a superuser, an admin with a duplicated
        // role row, an event of the current menu
        await conn.query(await fs.readFile(path.join(MIGRATIONS_DIR, '004_settings.sql'), 'utf8'))
        await conn.query(`REPLACE INTO settings (id, venue_name, primary_color) VALUES (1, 'Libra', '#112233')`)
        await conn.query(`INSERT INTO users (id, email) VALUES (50, 'super@test.local'), (51, 'admin@test.local')`)
        await conn.query(`INSERT INTO user_role (user_id, role_id) VALUES (50, 5), (51, 1), (51, 1), (51, 3)`)
        await conn.query(`INSERT INTO events (id, name, menu_id, status) VALUES (7, 'Sabato', 1, 'ONGOING')`)
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
        // Everything went into venue 1, with its branding; the superuser is the platform's
        expect(await query(db.database, 'SELECT id, name, primary_color FROM venues'))
            .toEqual([{ id: 1, name: 'Libra', primary_color: '#112233' }])
        expect(await query(db.database, 'SELECT venue_id FROM events')).toEqual([{ venue_id: 1 }])
        expect(await query(db.database, 'SELECT venue_id FROM menu')).toEqual([{ venue_id: 1 }])
        expect(await query(db.database, 'SELECT user_id, role_id, venue_id FROM user_role ORDER BY user_id, role_id'))
            .toEqual([
                { user_id: 50, role_id: 5, venue_id: null },
                { user_id: 51, role_id: 1, venue_id: 1 },
                { user_id: 51, role_id: 3, venue_id: 1 },
            ])

        // Same schema as a database created from scratch
        const fresh = await scratchDb('fresh')
        await migrate({ db: fresh, log: silent })
        expect(await schemaOf(db.database)).toEqual(await schemaOf(fresh.database))
    })

    it('puts every domain table in a venue, with composite foreign keys', async () => {
        const db = await scratchDb('venues')
        await migrate({ db, log: silent })
        const columns = await query(db.database, `
            SELECT table_name t, is_nullable n FROM information_schema.columns
            WHERE table_schema = ? AND column_name = 'venue_id'`, [db.database])
        const fks = await query(db.database, `
            SELECT table_name t, constraint_name c, referenced_table_name rt,
                   GROUP_CONCAT(column_name ORDER BY ordinal_position) cols,
                   GROUP_CONCAT(referenced_column_name ORDER BY ordinal_position) refs
            FROM information_schema.key_column_usage
            WHERE table_schema = ? AND referenced_table_name IS NOT NULL
            GROUP BY table_name, constraint_name, referenced_table_name`, [db.database])
        const tables = (await query(db.database,
            `SELECT table_name t FROM information_schema.tables WHERE table_schema = ?`, [db.database])).map(r => r.t)
        const venueTables = tables.filter(t => !GLOBAL_TABLES.includes(t))

        expect(columns.map(c => c.t).sort()).toEqual(venueTables.sort())
        // The list VenueDb guards is the schema's
        expect([...VENUE_TABLES].sort()).toEqual(venueTables.sort())
        // NULL is the platform, only where the plan allows it
        expect(columns.filter(c => c.n === 'YES').map(c => c.t).sort()).toEqual(['audit', 'user_role'])
        for (const t of venueTables) {
            expect(fks, t).toContainEqual(expect.objectContaining({ t, rt: 'venues', cols: 'venue_id', refs: 'id' }))
        }
        // A reference between two venue tables always carries the venue
        for (const fk of fks.filter(f => venueTables.includes(f.t) && venueTables.includes(f.rt))) {
            expect([fk.c, fk.cols.split(',')[0], fk.refs], fk.c).toEqual([fk.c, 'venue_id', 'venue_id,id'])
        }
    })

    it('refuses a row pointing to another venue', async () => {
        const db = await scratchDb('crossvenue')
        await migrate({ db, log: silent })
        await query(db.database, `INSERT INTO venues (id, name) VALUES (2, 'Altro')`)
        await query(db.database, `INSERT INTO events (id, venue_id, name, menu_id) VALUES (10, 1, 'A', 1)`)

        await expect(query(db.database, `INSERT INTO events (venue_id, name, menu_id) VALUES (2, 'B', 1)`))
            .rejects.toThrow(/foreign key constraint fails/)
        await expect(query(db.database, `INSERT INTO tables (venue_id, event_id, name) VALUES (2, 10, 'T')`))
            .rejects.toThrow(/foreign key constraint fails/)
        await query(db.database, `INSERT INTO tables (venue_id, event_id, name) VALUES (1, 10, 'T')`)
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
