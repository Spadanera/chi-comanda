import db, { placeholders, Queryable } from '../db'
import { type Event, type User } from '../../../models/src'
import { notify } from '../socket'
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors'
import { ITEM_CATEGORY_JOINS, ITEM_SUB_TYPE, ITEM_TYPE } from '../db/sql'
import { toSqlDate } from '../utils/date'

export type EventStatus = 'PLANNED' | 'ONGOING' | 'CLOSED'

const PAGE_SIZE = 20

/** Closed events have their tables and items archived in the *_history tables. */
function sourceTables(status: string) {
    return status === 'CLOSED'
        ? { tables: 'tables_history', items: 'items_history' }
        : { tables: 'tables', items: 'items' }
}

export interface EventFilters {
    page?: string
    start_date?: string
    end_date?: string
}

class EventService {
    async getAll(status: string, filters: EventFilters = {}): Promise<Event[] | { events: Event[], totalPages: number }> {
        const { tables, items } = sourceTables(status)

        const params: unknown[] = [status]
        let where = 'WHERE e.status = ?'
        if (filters.start_date) {
            where += ' AND e.date >= ?'
            params.push(filters.start_date)
        }
        if (filters.end_date) {
            where += ' AND e.date <= ?'
            params.push(filters.end_date)
        }

        const baseQuery = `
            SELECT
                e.id,
                e.name,
                e.date,
                e.status,
                e.minimumConsumptionPrice,
                m.name AS menu_name,
                e.menu_id AS menu_id,
                COALESCE(t_stats.tableCount, 0) AS tableCount,
                COALESCE(t_stats.tablesOpen, 0) AS tablesOpen,
                COALESCE(i_stats.revenue, 0) AS revenue,
                COALESCE(i_stats.discount, 0) AS discount,
                COALESCE(i_stats.currentPaid, 0) AS currentPaid,
                u_stats.users
            FROM events e
            INNER JOIN menu m ON e.menu_id = m.id
            LEFT JOIN (
                SELECT
                    event_id,
                    COUNT(id) AS tableCount,
                    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS tablesOpen
                FROM ${tables}
                GROUP BY event_id
            ) t_stats ON t_stats.event_id = e.id
            LEFT JOIN (
                SELECT
                    event_id,
                    -- Off-menu items have no type: IFNULL keeps them in the revenue
                    SUM(CASE WHEN IFNULL(type, '') != 'Sconto' THEN price ELSE 0 END) AS revenue,
                    SUM(CASE WHEN type = 'Sconto' THEN price ELSE 0 END) AS discount,
                    SUM(CASE WHEN IFNULL(type, '') != 'Sconto' AND paid = 1 THEN price ELSE 0 END) AS currentPaid
                FROM ${items}
                GROUP BY event_id
            ) i_stats ON i_stats.event_id = e.id
            LEFT JOIN (
                SELECT
                    ue.event_id,
                    JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'username', u.username, 'destination_id', ue.destination_id)) AS users
                FROM users u
                INNER JOIN user_event ue ON ue.user_id = u.id
                GROUP BY ue.event_id
            ) u_stats ON u_stats.event_id = e.id
            ${where}
            ORDER BY e.date DESC`

        if (filters.page) {
            const page = Math.max(parseInt(filters.page, 10) || 1, 1)
            const count = await db.queryOne<{ total: number }>(`SELECT COUNT(*) total FROM events e ${where}`, params)
            const totalPages = Math.ceil((count?.total || 0) / PAGE_SIZE)
            const events = await db.query<Event>(`${baseQuery} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, params)
            return { events, totalPages }
        }

        return db.query<Event>(baseQuery, params)
    }

    /** Event report: every table that ordered something, with its items grouped by product. */
    async getReport(id: number, status: string): Promise<Event> {
        const { tables, items } = sourceTables(status)
        const event = await db.queryOne<Event>(`
            SELECT
                events.id,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', grouped_tables.id,
                        'name', grouped_tables.table_name,
                        'revenue', grouped_tables.revenue,
                        'items', grouped_tables.items))
                    FROM (
                        SELECT
                            tables.id,
                            tables.name table_name,
                            (SELECT SUM(price) FROM ${items} items WHERE items.table_id = tables.id) revenue,
                            (
                                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                                    'name', grouped_items.name,
                                    'type', grouped_items.type,
                                    'sub_type', grouped_items.sub_type,
                                    'price', grouped_items.price,
                                    'quantity', grouped_items.quantity
                                ))
                                FROM (
                                    SELECT items.name, ${ITEM_TYPE} type, ${ITEM_SUB_TYPE} sub_type, items.price, COUNT(items.id) quantity
                                    FROM ${items} items
                                    ${ITEM_CATEGORY_JOINS}
                                    WHERE items.table_id = tables.id
                                    GROUP BY items.name, ${ITEM_TYPE}, ${ITEM_SUB_TYPE}, items.price
                                    ORDER BY ${ITEM_TYPE}, ${ITEM_SUB_TYPE}, items.name
                                ) grouped_items
                            ) items
                        FROM ${tables} tables
                        WHERE tables.event_id = events.id
                        AND EXISTS (SELECT id FROM ${items} items WHERE items.table_id = tables.id)
                    ) grouped_tables
                ) tables,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', users.id, 'username', users.username))
                    FROM users
                    INNER JOIN user_event ON user_event.user_id = users.id
                    WHERE user_event.event_id = events.id
                ) users
            FROM events WHERE events.id = ?`, [id])
        if (!event) {
            throw new NotFoundError()
        }
        return event
    }

    /** The ongoing event the user is staffed on (superusers see any ongoing event); `{}` when none. */
    async getOnGoing(userId: number): Promise<Event> {
        const event = await db.queryOne<Event>(`
            SELECT events.*,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT('id', users.id, 'username', users.username, 'avatar', users.avatar, 'destination_id', user_event.destination_id))
                FROM users
                INNER JOIN user_event ON user_event.user_id = users.id
                WHERE user_event.event_id = events.id
            ) users
            FROM events
            WHERE status = 'ONGOING'
            AND EXISTS (
                SELECT users.id
                FROM users
                INNER JOIN user_event ON user_event.user_id = users.id
                WHERE user_event.event_id = events.id
                AND users.id = ? AND users.status = 'ACTIVE'
                UNION
                SELECT users.id
                FROM users
                INNER JOIN user_role ON user_role.user_id = users.id
                INNER JOIN roles ON user_role.role_id = roles.id
                WHERE roles.name = 'superuser' AND users.id = ?
            )`, [userId, userId])
        return event || ({} as Event)
    }

    /** Bartenders must be assigned to an existing destination: they get the orders for it. */
    private async validateStaff(users: User[]) {
        if (!users.length) return
        const rows = await db.query<{ id: number, username: string, bartender: number }>(`
            SELECT id, username, EXISTS (
                SELECT 1 FROM user_role INNER JOIN roles ON roles.id = user_role.role_id
                WHERE user_role.user_id = users.id AND roles.name = 'bartender'
            ) bartender
            FROM users WHERE id IN (${placeholders(users)})`, users.map(u => u.id))
        const destinations = new Set((await db.query<{ id: number }>('SELECT id FROM destinations')).map(d => d.id))
        for (const user of users) {
            const row = rows.find(r => r.id === Number(user.id))
            if (user.destination_id && !destinations.has(Number(user.destination_id))) {
                throw new BadRequestError('Destinazione non valida')
            }
            if (row?.bartender && !user.destination_id) {
                throw new BadRequestError(`Scegli la destinazione di ${row.username}`)
            }
        }
    }

    private async replaceStaff(tx: Queryable, eventId: number, users: User[]) {
        await tx.execute('DELETE FROM user_event WHERE event_id = ?', [eventId])
        for (const user of users) {
            await tx.insert('INSERT INTO user_event (user_id, event_id, destination_id) VALUES (?,?,?)',
                [user.id, eventId, user.destination_id || null])
        }
    }

    async create(event: Event): Promise<number> {
        await this.validateStaff(event.users || [])
        return db.transaction(async tx => {
            const eventId = await tx.insert(
                `INSERT INTO events (name, date, status, menu_id, minimumConsumptionPrice) VALUES (?,?,'PLANNED',?,?)`,
                [event.name, toSqlDate(event.date), event.menu_id, event.minimumConsumptionPrice])
            await this.replaceStaff(tx, eventId, event.users || [])
            return eventId
        })
    }

    async update(event: Event): Promise<number> {
        if (!event.users) {
            throw new BadRequestError('Missing users')
        }
        await this.validateStaff(event.users)
        const result = await db.transaction(async tx => {
            const affected = await tx.execute(
                'UPDATE events SET name = ?, date = ?, menu_id = ?, minimumConsumptionPrice = ? WHERE id = ?',
                [event.name, toSqlDate(event.date), event.menu_id, event.minimumConsumptionPrice, event.id])
            await this.replaceStaff(tx, event.id!, event.users!)
            return affected
        })
        notify.eventsChanged()
        return result
    }

    async delete(id: number): Promise<number> {
        const tables = await db.query('SELECT id FROM tables WHERE event_id = ?', [id])
        if (tables.length) {
            throw new ConflictError("Impossibile eliminare l'evento: ci sono tavoli collegati")
        }
        return db.transaction(async tx => {
            await tx.execute('DELETE FROM user_event WHERE event_id = ?', [id])
            return tx.execute('DELETE FROM events WHERE id = ?', [id])
        })
    }

    async updateStatus(id: number, status: EventStatus): Promise<number> {
        let result: number
        if (status === 'ONGOING') {
            result = await this.start(id)
        } else if (status === 'CLOSED') {
            result = await this.close(id)
        } else {
            result = await db.execute('UPDATE events SET status = ? WHERE id = ?', [status, id])
        }
        notify.eventsChanged()
        return result
    }

    /** Starts the event with a fresh copy of the restaurant layout that can then be edited per event. */
    private start(id: number): Promise<number> {
        return db.transaction(async tx => {
            await tx.execute('DELETE FROM table_master_table')
            await tx.execute('DELETE FROM master_tables_event')
            const affected = await tx.execute(`UPDATE events SET status = 'ONGOING' WHERE id = ?`, [id])
            await tx.execute(`
                INSERT INTO master_tables_event (master_table_id, name, default_seats, status, room_id, x, y, width, height, shape, event_id)
                SELECT id, name, default_seats, status, room_id, x, y, width, height, shape, ?
                FROM master_tables WHERE status = 'ACTIVE'`, [id])
            return affected
        })
    }

    /** Closes the event, moving its orders, items and tables to the history tables. */
    private close(id: number): Promise<number> {
        return db.transaction(async tx => {
            await tx.execute(`
                INSERT INTO items_history (
                    id, event_id, table_id, order_id, master_item_id, type, sub_type, sub_type_id, icon, name, price, note, done, paid, destination_id
                )
                SELECT id, event_id, table_id, order_id, master_item_id, type, sub_type, sub_type_id, icon, name, price, note, done, paid, destination_id
                FROM items
                WHERE event_id = ?`, [id])
            await tx.execute('DELETE FROM items WHERE event_id = ?', [id])
            await tx.execute(`
                INSERT INTO orders_history (id, event_id, table_id, done, order_date, user_id)
                SELECT id, event_id, table_id, done, order_date, user_id
                FROM orders
                WHERE event_id = ?`, [id])
            await tx.execute('DELETE FROM orders WHERE event_id = ?', [id])
            await tx.execute(`
                INSERT INTO tables_history (id, event_id, name, paid, status, user_id)
                SELECT id, event_id, name, paid, status, user_id
                FROM tables
                WHERE event_id = ?`, [id])
            await tx.execute('DELETE FROM table_master_table')
            await tx.execute('DELETE FROM tables WHERE event_id = ?', [id])
            return tx.execute(`UPDATE events SET status = 'CLOSED' WHERE id = ?`, [id])
        })
    }
}

export default new EventService()
