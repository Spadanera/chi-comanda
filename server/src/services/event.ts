import { placeholders } from '../db'
import { type Event, type User } from '../../../models/src'
import { notify } from '../socket'
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors'
import { ITEM_CATEGORY_JOINS, ITEM_SUB_TYPE, ITEM_TYPE } from '../db/sql'
import { toSqlDate } from '../utils/date'
import { isFeatureEnabled } from '../config'
import { Roles } from '../http/middleware'
import { VenueContext } from '../venue/context'
import { VenueDb } from '../venue/db'

export type EventStatus = 'PLANNED' | 'ONGOING' | 'CLOSED'

const PAGE_SIZE = 20

/** Without the minimum-consumption function events have no minimum price. */
function minimumPrice(event: Event) {
    return isFeatureEnabled('minimum-consumption') ? event.minimumConsumptionPrice : null
}

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
    async getAll(ctx: VenueContext, status: string, filters: EventFilters = {}): Promise<Event[] | { events: Event[], totalPages: number }> {
        const { tables, items } = sourceTables(status)

        const params: unknown[] = [status]
        let where = 'WHERE e.venue_id = :venue AND e.status = ?'
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
            INNER JOIN menu m ON m.venue_id = :venue AND e.menu_id = m.id
            LEFT JOIN (
                SELECT
                    event_id,
                    COUNT(id) AS tableCount,
                    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS tablesOpen
                FROM ${tables}
                WHERE venue_id = :venue
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
                WHERE venue_id = :venue
                GROUP BY event_id
            ) i_stats ON i_stats.event_id = e.id
            LEFT JOIN (
                SELECT
                    ue.event_id,
                    JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'username', u.username, 'destination_id', ue.destination_id)) AS users
                FROM users u
                INNER JOIN user_event ue ON ue.venue_id = :venue AND ue.user_id = u.id
                GROUP BY ue.event_id
            ) u_stats ON u_stats.event_id = e.id
            ${where}
            ORDER BY e.date DESC`

        if (filters.page) {
            const page = Math.max(parseInt(filters.page, 10) || 1, 1)
            const count = await ctx.db.queryOne<{ total: number }>(`SELECT COUNT(*) total FROM events e ${where}`, params)
            const totalPages = Math.ceil((count?.total || 0) / PAGE_SIZE)
            const events = await ctx.db.query<Event>(`${baseQuery} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, params)
            return { events, totalPages }
        }

        return ctx.db.query<Event>(baseQuery, params)
    }

    /** Event report: every table that ordered something, with its items grouped by product. */
    async getReport(ctx: VenueContext, id: number, status: string): Promise<Event> {
        const { tables, items } = sourceTables(status)
        await ctx.db.find('events', id, 'id')
        return (await ctx.db.queryOne<Event>(`
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
                            (SELECT SUM(price) FROM ${items} items WHERE items.venue_id = :venue AND items.table_id = tables.id) revenue,
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
                                    WHERE items.venue_id = :venue AND items.table_id = tables.id
                                    GROUP BY items.name, ${ITEM_TYPE}, ${ITEM_SUB_TYPE}, items.price
                                    ORDER BY ${ITEM_TYPE}, ${ITEM_SUB_TYPE}, items.name
                                ) grouped_items
                            ) items
                        FROM ${tables} tables
                        WHERE tables.venue_id = :venue AND tables.event_id = events.id
                        AND EXISTS (SELECT id FROM ${items} items WHERE items.venue_id = :venue AND items.table_id = tables.id)
                    ) grouped_tables
                ) tables,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', users.id, 'username', users.username))
                    FROM users
                    INNER JOIN user_event ON user_event.venue_id = :venue AND user_event.user_id = users.id
                    WHERE user_event.event_id = events.id
                ) users
            FROM events WHERE events.venue_id = :venue AND events.id = ?`, [id]))!
    }

    /** The ongoing event of the venue the user is staffed on (superusers see any); `{}` when none. */
    async getOnGoing(ctx: VenueContext): Promise<Event> {
        const superuser = ctx.roles.includes(Roles.superuser)
        const event = await ctx.db.queryOne<Event>(`
            SELECT events.*,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT('id', users.id, 'username', users.username, 'avatar', users.avatar, 'destination_id', user_event.destination_id))
                FROM users
                INNER JOIN user_event ON user_event.venue_id = :venue AND user_event.user_id = users.id
                WHERE user_event.event_id = events.id
            ) users
            FROM events
            WHERE events.venue_id = :venue AND status = 'ONGOING'
            AND (? OR EXISTS (
                SELECT users.id
                FROM users
                INNER JOIN user_event ON user_event.venue_id = :venue AND user_event.user_id = users.id
                WHERE user_event.event_id = events.id
                AND users.id = ? AND users.status = 'ACTIVE'
            ))`, [superuser, ctx.userId])
        return event || ({} as Event)
    }

    /**
     * Staff must hold a role in the venue or be the superuser (404 otherwise, as for any id of another venue), and bartenders must be
     * assigned to one of the venue's destinations: they get the orders for it.
     */
    private async validateStaff(ctx: VenueContext, users: User[]) {
        if (!users.length) return
        const rows = await ctx.db.query<{ id: number, username: string, bartender: number }>(`
            SELECT users.id, users.username, EXISTS (
                SELECT 1 FROM user_role INNER JOIN roles ON roles.id = user_role.role_id
                WHERE user_role.venue_id = :venue AND user_role.user_id = users.id AND roles.name = 'bartender'
            ) bartender
            FROM users
            WHERE users.id IN (${placeholders(users)})
            AND EXISTS (
                SELECT 1 FROM user_role INNER JOIN roles ON roles.id = user_role.role_id
                WHERE user_role.user_id = users.id AND (user_role.venue_id = :venue OR roles.name = 'superuser')
            )`,
            users.map(u => u.id))
        const destinations = new Set((await ctx.db.query<{ id: number }>('SELECT id FROM destinations WHERE venue_id = :venue')).map(d => d.id))
        for (const user of users) {
            const row = rows.find(r => r.id === Number(user.id))
            if (!row) {
                throw new NotFoundError()
            }
            if (user.destination_id && !destinations.has(Number(user.destination_id))) {
                throw new BadRequestError('Destinazione non valida')
            }
            if (row.bartender && !user.destination_id) {
                throw new BadRequestError(`Scegli la destinazione di ${row.username}`)
            }
        }
    }

    private async replaceStaff(tx: VenueDb, eventId: number, users: User[]) {
        await tx.execute('DELETE FROM user_event WHERE venue_id = :venue AND event_id = ?', [eventId])
        for (const user of users) {
            await tx.insert('INSERT INTO user_event (venue_id, user_id, event_id, destination_id) VALUES (:venue,?,?,?)',
                [user.id, eventId, user.destination_id || null])
        }
    }

    async create(ctx: VenueContext, event: Event): Promise<number> {
        await ctx.db.find('menu', event.menu_id, 'id')
        await this.validateStaff(ctx, event.users || [])
        return ctx.db.transaction(async tx => {
            const eventId = await tx.insert(`
                INSERT INTO events (venue_id, name, date, status, menu_id, minimumConsumptionPrice)
                VALUES (:venue,?,?,'PLANNED',?,?)`,
                [event.name, toSqlDate(event.date), event.menu_id, minimumPrice(event)])
            await this.replaceStaff(tx, eventId, event.users || [])
            return eventId
        })
    }

    async update(ctx: VenueContext, event: Event): Promise<number> {
        if (!event.users) {
            throw new BadRequestError('Missing users')
        }
        await ctx.db.find('events', event.id, 'id')
        await ctx.db.find('menu', event.menu_id, 'id')
        await this.validateStaff(ctx, event.users)
        const result = await ctx.db.transaction(async tx => {
            const affected = await tx.execute(
                'UPDATE events SET name = ?, date = ?, menu_id = ?, minimumConsumptionPrice = ? WHERE venue_id = :venue AND id = ?',
                [event.name, toSqlDate(event.date), event.menu_id, minimumPrice(event), event.id])
            await this.replaceStaff(tx, event.id!, event.users!)
            return affected
        })
        notify.eventsChanged()
        return result
    }

    async delete(ctx: VenueContext, id: number): Promise<number> {
        await ctx.db.find('events', id, 'id')
        const tables = await ctx.db.query('SELECT id FROM tables WHERE venue_id = :venue AND event_id = ?', [id])
        if (tables.length) {
            throw new ConflictError("Impossibile eliminare l'evento: ci sono tavoli collegati")
        }
        return ctx.db.transaction(async tx => {
            await tx.execute('DELETE FROM user_event WHERE venue_id = :venue AND event_id = ?', [id])
            return tx.execute('DELETE FROM events WHERE venue_id = :venue AND id = ?', [id])
        })
    }

    async updateStatus(ctx: VenueContext, id: number, status: EventStatus): Promise<number> {
        await ctx.db.find('events', id, 'id')
        let result: number
        if (status === 'ONGOING') {
            result = await this.start(ctx, id)
        } else if (status === 'CLOSED') {
            result = await this.close(ctx, id)
        } else {
            result = await ctx.db.execute('UPDATE events SET status = ? WHERE venue_id = :venue AND id = ?', [status, id])
        }
        notify.eventsChanged()
        return result
    }

    /** Starts the event with a fresh copy of the venue layout that can then be edited per event. */
    private start(ctx: VenueContext, id: number): Promise<number> {
        return ctx.db.transaction(async tx => {
            await tx.execute('DELETE FROM table_master_table WHERE venue_id = :venue')
            await tx.execute('DELETE FROM master_tables_event WHERE venue_id = :venue')
            const affected = await tx.execute(`UPDATE events SET status = 'ONGOING' WHERE venue_id = :venue AND id = ?`, [id])
            await tx.execute(`
                INSERT INTO master_tables_event (venue_id, master_table_id, name, default_seats, status, room_id, x, y, width, height, shape, event_id)
                SELECT :venue, id, name, default_seats, status, room_id, x, y, width, height, shape, ?
                FROM master_tables WHERE venue_id = :venue AND status = 'ACTIVE'`, [id])
            return affected
        })
    }

    /** Closes the event, moving its orders, items and tables to the history tables. */
    private close(ctx: VenueContext, id: number): Promise<number> {
        return ctx.db.transaction(async tx => {
            await tx.execute(`
                INSERT INTO items_history (
                    venue_id, id, event_id, table_id, order_id, master_item_id, type, sub_type, sub_type_id, icon, name, price, note, done, paid, destination_id
                )
                SELECT :venue, id, event_id, table_id, order_id, master_item_id, type, sub_type, sub_type_id, icon, name, price, note, done, paid, destination_id
                FROM items
                WHERE venue_id = :venue AND event_id = ?`, [id])
            await tx.execute('DELETE FROM items WHERE venue_id = :venue AND event_id = ?', [id])
            await tx.execute(`
                INSERT INTO orders_history (venue_id, id, event_id, table_id, done, order_date, user_id)
                SELECT :venue, id, event_id, table_id, done, order_date, user_id
                FROM orders
                WHERE venue_id = :venue AND event_id = ?`, [id])
            await tx.execute('DELETE FROM orders WHERE venue_id = :venue AND event_id = ?', [id])
            await tx.execute(`
                INSERT INTO tables_history (venue_id, id, event_id, name, paid, status, user_id)
                SELECT :venue, id, event_id, name, paid, status, user_id
                FROM tables
                WHERE venue_id = :venue AND event_id = ?`, [id])
            await tx.execute('DELETE FROM table_master_table WHERE venue_id = :venue')
            await tx.execute('DELETE FROM tables WHERE venue_id = :venue AND event_id = ?', [id])
            return tx.execute(`UPDATE events SET status = 'CLOSED' WHERE venue_id = :venue AND id = ?`, [id])
        })
    }
}

export default new EventService()
