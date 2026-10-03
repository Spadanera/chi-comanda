import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { assertScoped } from '../src/venue/db'

const SERVICES_DIR = path.resolve(__dirname, '../src/services')

/**
 * Services working on global tables only (users, sessions, push subscriptions...) or on no table: the only ones
 * allowed to use the raw database. Every other service reaches it through the venue context.
 */
const PLATFORM_SERVICES = ['health.ts', 'pricing.ts', 'profile.ts', 'user.ts', 'venue.ts']

/** Not moved to the venue context yet (multi-venue point 3): this list only shrinks. */
const NOT_CONVERTED_YET = ['audit.ts', 'event.ts', 'item.ts', 'order.ts', 'payment.ts', 'push.ts', 'settings.ts', 'table.ts']

const RAW_DB_IMPORT = /import\s+db\b[^;]*from\s+'\.\.\/db'/

describe('architecture', () => {
    it('lets only platform services use the raw database', () => {
        const offenders = fs.readdirSync(SERVICES_DIR)
            .filter(f => !PLATFORM_SERVICES.includes(f) && !NOT_CONVERTED_YET.includes(f))
            .filter(f => RAW_DB_IMPORT.test(fs.readFileSync(path.join(SERVICES_DIR, f), 'utf8')))
        expect(offenders).toEqual([])
    })

    it('refuses venue queries without a :venue for each table', () => {
        expect(() => assertScoped('SELECT * FROM menu')).toThrow(/0 :venue for 1/)
        expect(() => assertScoped('SELECT * FROM menu WHERE venue_id = :venue')).not.toThrow()
        expect(() => assertScoped(`
            SELECT * FROM master_items
            INNER JOIN destinations ON destinations.id = master_items.destination_id
            WHERE master_items.venue_id = :venue`)).toThrow(/1 :venue for 2/)
        expect(() => assertScoped('UPDATE `tables` SET status = ? WHERE id = ?')).toThrow()
        expect(() => assertScoped('INSERT INTO menu (venue_id, name) VALUES (:venue, ?)')).not.toThrow()
        expect(() => assertScoped('DELETE FROM table_master_table')).toThrow()
        // Global tables and column names that look like tables don't count
        expect(() => assertScoped('SELECT id FROM users WHERE id = ?')).not.toThrow()
        expect(() => assertScoped(`SELECT JSON_OBJECT('items', 1) FROM users`)).not.toThrow()
        expect(() => assertScoped('SELECT * FROM tables_history WHERE venue_id = :venue')).not.toThrow()
    })
})
