import db, { placeholders, Queryable } from '../db'
import { NotFoundError } from '../http/errors'

/** Tables whose rows belong to a venue (`venue_id`). The migration tests check the list against the schema. */
export const VENUE_TABLES = [
    'audit', 'destinations', 'events', 'items', 'items_history', 'master_items', 'master_tables', 'master_tables_event',
    'menu', 'orders', 'orders_history', 'payment_settings', 'payment_transactions', 'rooms', 'sub_types',
    'table_master_table', 'tables', 'tables_history', 'types', 'user_event', 'user_role',
] as const
export type VenueTable = typeof VENUE_TABLES[number]

const VENUE_TOKEN = /:venue\b/g
const TABLE_REFERENCE = new RegExp(`\\b(?:FROM|JOIN|UPDATE|INTO)\\s+\`?(${VENUE_TABLES.join('|')})\`?(?![\\w.])`, 'gi')

/**
 * Every reference to a venue table (FROM, JOIN, UPDATE, INTO) must come with its own `:venue`, e.g.
 * `JOIN destinations ON destinations.id = master_items.destination_id AND destinations.venue_id = :venue`, or
 * `INSERT INTO menu (venue_id, name) VALUES (:venue, ?)`. Counting can't prove the SQL right, but a query that forgets
 * the venue of a table fails on its first run, i.e. in the tests.
 */
export function assertScoped(sql: string) {
    const references = sql.match(TABLE_REFERENCE)?.length ?? 0
    const tokens = sql.match(VENUE_TOKEN)?.length ?? 0
    if (references > tokens) {
        throw new Error(`Query on venue tables with ${tokens} :venue for ${references} table references: ${sql.trim().slice(0, 300)}`)
    }
}

/**
 * Query helpers bound to one venue. `:venue` in the SQL is replaced with the venue id (an integer from the session,
 * never from the request), so a service can't scope a query to another venue.
 */
export class VenueDb {
    constructor(readonly venueId: number, private readonly executor: Queryable = db) {
        if (!Number.isInteger(venueId) || venueId <= 0) {
            throw new Error(`Invalid venue id: ${venueId}`)
        }
    }

    private bind(sql: string): string {
        assertScoped(sql)
        return sql.replace(VENUE_TOKEN, String(this.venueId))
    }

    async query<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
        return this.executor.query<T>(this.bind(sql), params)
    }

    async queryOne<T = any>(sql: string, params?: unknown[]): Promise<T | undefined> {
        return this.executor.queryOne<T>(this.bind(sql), params)
    }

    /** Returns the number of affected rows. */
    async execute(sql: string, params?: unknown[]): Promise<number> {
        return this.executor.execute(this.bind(sql), params)
    }

    /** For statements on a row picked by the request: nothing matched (e.g. another venue's id) is a 404. */
    async executeOne(sql: string, params?: unknown[]): Promise<number> {
        const affected = await this.execute(sql, params)
        if (!affected) throw new NotFoundError()
        return affected
    }

    /** Returns the id of the inserted row. */
    async insert(sql: string, params?: unknown[]): Promise<number> {
        return this.executor.insert(this.bind(sql), params)
    }

    /** The row `id` of `table` in this venue; 404 when it doesn't exist here. */
    async find<T = any>(table: VenueTable, id: unknown, columns = '*'): Promise<T> {
        const row = await this.queryOne<T>(`SELECT ${columns} FROM ${table} WHERE venue_id = :venue AND id = ?`, [id])
        if (!row) throw new NotFoundError()
        return row
    }

    /** Checks that every id (e.g. taken from a request body) is a row of `table` in this venue; 404 otherwise. */
    async ensure(table: VenueTable, ids: unknown[]): Promise<void> {
        const distinct = [...new Set(ids.filter(id => id !== null && id !== undefined))]
        if (!distinct.length) return
        const [{ n }] = await this.query<{ n: number }>(
            `SELECT COUNT(*) n FROM ${table} WHERE venue_id = :venue AND id IN (${placeholders(distinct)})`, distinct)
        if (Number(n) !== distinct.length) throw new NotFoundError()
    }

    /** Runs `work` in a transaction; inside one already, it just runs. */
    transaction<T>(work: (tx: VenueDb) => Promise<T>): Promise<T> {
        if (this.executor !== db) return work(this)
        return db.transaction(tx => work(new VenueDb(this.venueId, tx)))
    }
}
