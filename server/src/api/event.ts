import db from "../db"
import { type Event, type User } from "../../../models/src"
import { SocketIOService } from "../socket"

class EventAPI {
    constructor() {
    }

    async getAll(status: string, query?: any): Promise<Event[] | { events: Event[], totalPages: number }> {
        let tables = 'tables'
        let items = 'items'
        if (status === 'CLOSED') {
            tables = 'tables_history'
            items = 'items_history'
        }

        // Array dei parametri per i prepared statements (solo per WHERE)
        const params: any[] = [status]
        let whereClause = 'WHERE e.status = ?'

        // Gestione filtri opzionali
        if (query?.start_date) {
            whereClause += ' AND e.date >= ?'
            params.push(query.start_date)
        }
        if (query?.end_date) {
            whereClause += ' AND e.date <= ?'
            params.push(query.end_date)
        }

        const baseQuery = `
        SELECT
            e.id,
            e.name,
            e.date,
            e.status,
            m.name AS menu_name,
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
                SUM(CASE WHEN type != 'Sconto' THEN price ELSE 0 END) AS revenue,
                SUM(CASE WHEN type = 'Sconto' THEN price ELSE 0 END) AS discount,
                SUM(CASE WHEN type != 'Sconto' AND paid = 1 THEN price ELSE 0 END) AS currentPaid
            FROM ${items}
            GROUP BY event_id
        ) i_stats ON i_stats.event_id = e.id
        LEFT JOIN (
            SELECT
                ue.event_id,
                JSON_ARRAYAGG(JSON_OBJECT(
                    'id', u.id,
                    'username', u.username
                )) AS users
            FROM users u
            INNER JOIN user_event ue ON ue.user_id = u.id
            GROUP BY ue.event_id
        ) u_stats ON u_stats.event_id = e.id
        ${whereClause}`

        if (query?.page) {
            const page = parseInt(query.page, 10) || 1
            const limit = 20
            const offset = (page - 1) * limit

            const countResult = await db.query(`SELECT COUNT(*) as total FROM events e ${whereClause}`, params)
            const totalPages = Math.ceil((countResult[0]?.total || 0) / limit)

            const events = await db.query(
                `${baseQuery} ORDER BY e.date DESC LIMIT ${limit} OFFSET ${offset}`,
                params
            )
            console.log(whereClause, params)
            return { events, totalPages }
        }

        return await db.query(`${baseQuery} ORDER BY e.date DESC`, params)
    }

    async get(id: number, status: string): Promise<Event[]> {
        let tables = 'tables'
        let items = 'items'
        if (status === 'CLOSED') {
            tables = 'tables_history'
            items = 'items_history'
        }
        return await db.query(`
            SELECT 
                events.id,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', grouped_tables.id,
                        'name', grouped_tables.table_name,
                        'revenue', grouped_tables.revenue,
                        'items', grouped_tables.items))
                        FROM 
                        (SELECT 
                            tables.id, tables.name table_name,
                            (SELECT SUM(price) FROM ${items} items WHERE items.table_id = tables.id) revenue, (
                                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                                    'name', grouped_items.name, 
                                    'type', grouped_items.type, 
                                    'sub_type', grouped_items.sub_type, 
                                    'price', grouped_items.price,
                                    'quantity', grouped_items.quantity
                                )) 
                                FROM (
                                    SELECT items.name, IFNULL(types.name, items.type) type, IFNULL(sub_types.name, items.sub_type) sub_type, items.price, COUNT(items.id) quantity
                                    FROM ${items} items
                                    LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
                                    LEFT JOIN types ON sub_types.type_id = types.id
                                    WHERE items.table_id = tables.id
                                    GROUP BY items.name, IFNULL(types.name, items.type), IFNULL(sub_types.name, items.sub_type), items.price
                                    ORDER BY IFNULL(types.name, items.type), IFNULL(sub_types.name, items.sub_type), items.name
                                ) grouped_items
                            ) items
                        FROM ${tables} tables
                        WHERE tables.event_id = events.id
                        AND EXISTS (SELECT id FROM ${items} items WHERE items.table_id = tables.id)
                    ) grouped_tables
                ) tables,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', users.id, 
                        'username', users.username
                    ))
                    FROM users 
                    INNER JOIN user_event ON user_event.user_id = users.id
                    WHERE user_event.event_id = events.id
                ) users
            FROM events WHERE events.id = ?`
            , [id])
    }

    async getOnGoing(userId: number): Promise<Event> {
        try {
            return await db.queryOne<Event>(`
                SELECT events.*,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', users.id, 
                        'username', users.username,
                        'avatar', users.avatar
                    ))
                    FROM users 
                    INNER JOIN user_event ON user_event.user_id = users.id
                    WHERE user_event.event_id = events.id
                ) users
                FROM events 
                WHERE STATUS = "ONGOING"
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
                )
                `, [userId, userId])
        } catch (error) {
            return {} as Event
        }
    }

    async create(event: Event): Promise<number> {
        const eventId = await db.executeInsert('INSERT INTO events (name, date, status, menu_id) VALUES (?,?,?,?)', [event.name, (event.date + "").split('T')[0], 'PLANNED', event.menu_id])
        if (event.users) {
            await db.executeTransaction(
                event.users.map((u: User) => 'INSERT INTO user_event (user_id, event_id) VALUES (?,?)'),
                event.users.map((u: User) => [u.id, eventId])
            )
        }
        return eventId
    }

    async delete(id: number): Promise<number> {
        const tables = await db.query('SELECT id FROM tables WHERE event_id = ?', [id])
        if (tables.length) {
            throw new Error("Can't delete the event. Tables connected")
        }
        return await db.executeTransaction(
            [
                'DELETE FROM user_event WHERE event_id = ?',
                'DELETE FROM events WHERE id = ?'
            ]
            , [
                [id],
                [id]
            ])
    }

    async updateStatus(event: Event): Promise<number> {
        let result
        if (event.status === 'ONGOING') {
            result = await db.executeTransaction(
                [
                    'DELETE FROM table_master_table',
                    'DELETE FROM master_tables_event',
                    'UPDATE events SET status = ? WHERE id = ?',
                    `INSERT INTO master_tables_event (master_table_id, name, default_seats, status, room_id, x, y, width, height, shape, event_id)
                    SELECT id, name, default_seats, status, room_id, x, y, width, height, shape, ${event.id}
                    FROM master_tables WHERE status = 'ACTIVE'`
                ],
                [
                    [],
                    [],
                    [event.status, event.id],
                    []
                ])
        }
        else if (event.status === 'CLOSED') {
            result = await db.executeTransaction([
                `INSERT INTO items_history (
                    id, event_id, table_id, order_id, master_item_id, type, sub_type, sub_type_id, icon, name, price, note, done, paid, destination_id
                    )
                    SELECT 
                    id, event_id, table_id, order_id, master_item_id, type, sub_type, sub_type_id, icon, name, price, note, done, paid, destination_id
                    FROM items 
                    WHERE event_id = ?`,
                'DELETE FROM items WHERE event_id = ?',
                `INSERT INTO orders_history (id, event_id, table_id, done, order_date, user_id)
                    SELECT id, event_id, table_id, done, order_date, user_id
                    FROM orders 
                    WHERE event_id = ?`,
                'DELETE FROM orders WHERE event_id = ?',
                `INSERT INTO tables_history (id, event_id, name, paid, status, user_id)
                    SELECT id, event_id, name, paid, status, user_id 
                    FROM tables 
                    WHERE event_id = ?`,
                'TRUNCATE TABLE table_master_table',
                'DELETE FROM tables WHERE event_id = ?',
                'UPDATE events SET status = ? WHERE id = ?'
            ], [
                [event.id],
                [event.id],
                [event.id],
                [event.id],
                [event.id],
                [],
                [event.id],
                [event.status, event.id]
            ])
        }
        else {
            result = await db.executeUpdate('UPDATE events SET status = ? WHERE id = ?', [event.status, event.id])
        }
        SocketIOService.instance().sendMessage({
            room: "main",
            event: "reload"
        })
        return result
    }

    async update(event: Event): Promise<number> {
        if (event.users) {
            const result = await db.executeTransaction(
                [
                    'UPDATE events SET name = ?, date = ?, menu_id = ? WHERE id = ?',
                    'DELETE FROM user_event WHERE event_id = ?',
                    ...event.users.map((u: User) => 'INSERT INTO user_event (user_id, event_id) VALUES (?,?)')
                ],
                [
                    [event.name, (event.date + "").split('T')[0], event.menu_id, event.id],
                    [event.id],
                    ...event.users.map((u: User) => [u.id, event.id])
                ]
            )
            SocketIOService.instance().sendMessage({
                room: "main",
                event: "reload"
            })
            return result
        }
        throw new Error("Missing users")
    }
}

const eventApi = new EventAPI()

export default eventApi
