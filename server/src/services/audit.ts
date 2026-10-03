import db from '../db'
import { Audit } from '../../../models/src'
import { nowInItaly } from '../utils/date'

const SORTABLE_COLUMNS: Record<string, string> = {
    id: 'audit.id',
    venue_name: 'venues.name',
    username: 'users.username',
    method: 'audit.method',
    path: 'audit.path',
    dateTime: 'audit.dateTime',
}

/**
 * Platform service: the middleware records every venue's actions (venue_id NULL for platform ones) and the superuser
 * reads them all.
 */
class AuditService {
    /** Best effort: auditing must never break the request being audited. */
    async insert(audit: Partial<Audit>): Promise<void> {
        try {
            await db.execute('INSERT INTO audit (venue_id, user_id, method, path, data, dateTime) VALUES (?,?,?,?,?,?)',
                [audit.venue_id ?? null, audit.user_id, audit.method, audit.path, audit.data, nowInItaly()])
        } catch (error: any) {
            console.error('Error inserting audit', error.message)
        }
    }

    async get(page: number, itemsPerPage: number, sortBy?: string, sortDir?: string): Promise<{ data: Audit[], totalCount: number }> {
        const column = SORTABLE_COLUMNS[sortBy || ''] || SORTABLE_COLUMNS.dateTime
        const direction = sortDir === 'asc' ? 'ASC' : 'DESC'
        const limit = Math.min(Math.max(itemsPerPage, 1), 500)
        const offset = (Math.max(page, 1) - 1) * limit
        // LIMIT/OFFSET are validated integers: prepared statements don't accept them as parameters reliably
        const data = await db.query<Audit>(`
            SELECT audit.id, audit.venue_id, venues.name venue_name, users.id user_id, users.username,
                audit.method, audit.path, audit.dateTime, audit.data
            FROM audit
            INNER JOIN users ON users.id = audit.user_id
            LEFT JOIN venues ON venues.id = audit.venue_id
            ORDER BY ${column} ${direction}
            LIMIT ${limit} OFFSET ${offset}`)
        const total = await db.queryOne<{ count: number }>('SELECT COUNT(*) count FROM audit')
        return { data, totalCount: Number(total?.count || 0) }
    }
}

export default new AuditService()
