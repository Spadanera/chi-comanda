import db from "../db"
import { MasterTable, RestaurantLayout, Room, Table, Event } from "../../../models/src"
import { SocketIOService } from "../socket"

class TableApi {
    constructor() {
    }

    async getFreeTable(eventId: number): Promise<MasterTable[]> {
        return await db.query(`
            SELECT 
            master_tables.id table_id, 
            master_tables.name table_name
            FROM master_tables_event master_tables
            WHERE id NOT IN (
				SELECT master_table_id from table_master_table
				WHERE table_id IN (
					SELECT id FROM tables WHERE event_id = ? AND status = 'ACTIVE'
				)
            ) AND master_tables.event_id = ? AND master_tables.status = 'ACTIVE'
            `, [eventId, eventId])
    }

    async changeTable(table_id: number, master_table_id: number): Promise<number> {
        const table_name = (await db.queryOne<MasterTable>("SELECT name FROM master_tables_event WHERE id = ?", [master_table_id])).name
        const table_master_table: number = (await db.queryOne("SELECT id FROM table_master_table WHERE table_id = ?", [table_id])).id
        const result = await db.executeTransaction([
            table_master_table ?
                "UPDATE table_master_table SET master_table_id = ? WHERE table_id = ?" :
                "INSERT INTO table_master_table (master_table_id, table_id) VALUES (?, ?)",
            "UPDATE tables SET name = ? WHERE id = ?"
        ], [
            [master_table_id, table_id],
            [table_name, table_id]
        ])
        SocketIOService.instance().sendMessage({
            rooms: ["waiter", "bartender", "table", "checkout"],
            event: "reload-table",
            body: {}
        })
        return result
    }

    async insertDiscount(eventId: number, tableId: number, discount: number): Promise<number> {
        return await db.executeInsert(`INSERT INTO items (
                name, event_id, table_id, type, sub_type, price, done, paid, destination_id, icon
            ) VALUES (
                ?,?,?,?,?,?,?,?,?,?
            )`, ['Sconto', eventId, tableId, 'Sconto', 'Sconto', discount * -1, true, true, 1, 'mdi-cart-percent'])
    }

    async getAvailableTable(eventId: number): Promise<MasterTable[]> {
        return await db.query(`SELECT 
            available_tables.id table_id, 
            available_tables.name table_name, 
            master_tables.id master_table_id,
            master_tables.id id, 
            master_tables.name master_table_name,
            master_tables.default_seats,
            IFNULL(master_tables.room_id, 0) room_id,
            master_tables.x,
            master_tables.y,
            master_tables.width,
            master_tables.height,
            master_tables.shape,
            available_tables.event_id,
            IF(available_tables.id IS NULL, 0, 1) inUse
            FROM (SELECT tables.id, tables.name, table_master_table.master_table_id, tables.event_id
                FROM tables
                INNER JOIN table_master_table ON tables.id = table_master_table.table_id
                WHERE tables.status = 'ACTIVE' AND tables.event_id = ?) available_tables
            RIGHT JOIN master_tables_event master_tables ON available_tables.master_table_id = master_tables.id
            WHERE master_tables.status = 'ACTIVE' AND master_tables.event_id = ?
            UNION
            SELECT 
                tables.id table_id, 
                tables.name table_name, 
                null master_table_id, 
                null id, 
                tables.name master_table_name,
                null default_seats,
                0 room_id,
                null x,
                null y,
                null width,
                null height,
                null shape,
                tables.event_id,
                1 inUse
            FROM tables
            WHERE tables.status = 'ACTIVE' AND event_id = ?
            AND id NOT IN (SELECT table_id FROM table_master_table)
            ORDER BY table_name DESC, master_table_name`, [eventId, eventId, eventId])
    }

    async getAvailableTableV2(eventId: number): Promise<MasterTable[]> {
        return await db.query(`SELECT 
            available_tables.id table_id, 
            available_tables.name table_name, 
            master_tables.id master_table_id,
            master_tables.id id, 
            master_tables.name master_table_name,
            master_tables.default_seats,
            CASE WHEN IFNULL(available_tables.status, 'ACTIVE') = 'ACTIVE' THEN IFNULL(master_tables.room_id, 0) ELSE -1 END room_id,
            master_tables.x,
            master_tables.y,
            master_tables.width,
            master_tables.height,
            master_tables.shape,
            available_tables.event_id,
            IF(available_tables.id IS NULL, 0, 1) inUse,
            available_tables.status status,
            IFNULL((
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', items.id, 
                    'master_item_id', items.master_item_id, 
                    'event_id', items.event_id,
                    'table_id', items.table_id,
                    'order_id', items.order_id,
                    'note', items.note, 
                    'name', items.name, 
                    'type', IFNULL(types.name, items.type), 
                    'icon', IFNULL(sub_types.icon, items.icon), 
                    'sub_type', IFNULL(sub_types.name, items.sub_type), 
                    'price', items.price,
                    'destination_id', items.destination_id,
                    'done', items.done,
                    'paid', items.paid,
                    'setMinimum', items.setMinimum
                )) 
                FROM items 
                LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
                LEFT JOIN types ON sub_types.type_id = types.id
                WHERE table_id = available_tables.id
            ), JSON_ARRAY()) items,
            (
                SELECT JSON_OBJECT(
                    'id', users.id, 
                    'username', users.username
                )
                FROM users 
                WHERE users.id = available_tables.user_id
            ) user
            FROM (SELECT tables.id, tables.name, table_master_table.master_table_id, tables.event_id, tables.status, tables.user_id
                FROM tables
                LEFT JOIN table_master_table ON tables.id = table_master_table.table_id
                WHERE tables.event_id = ? AND (tables.status = 'CLOSED' OR table_master_table.id IS NOT NULL)) available_tables
            RIGHT JOIN master_tables_event master_tables ON available_tables.master_table_id = master_tables.id
            WHERE master_tables.status = 'ACTIVE' AND master_tables.event_id = ?
            UNION
            SELECT 
                tables.id table_id, 
                tables.name table_name, 
                null master_table_id, 
                null id, 
                tables.name master_table_name,
                null default_seats,
                CASE WHEN status = 'CLOSED' THEN -1 ELSE 0 END room_id,
                null x,
                null y,
                null width,
                null height,
                null shape,
                tables.event_id,
                1 inUse,
                tables.status status,
                IFNULL((
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', items.id, 
                        'master_item_id', items.master_item_id, 
                        'event_id', items.event_id,
                        'table_id', items.table_id,
                        'order_id', items.order_id,
                        'note', items.note, 
                        'name', items.name, 
                        'type', IFNULL(types.name, items.type), 
                        'icon', IFNULL(sub_types.icon, items.icon), 
                        'sub_type', IFNULL(sub_types.name, items.sub_type), 
                        'price', items.price,
                        'destination_id', items.destination_id,
                        'done', items.done,
                        'paid', items.paid,
                        'setMinimum', items.setMinimum
                    )) 
                    FROM items 
                    LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
                    LEFT JOIN types ON sub_types.type_id = types.id
                    WHERE table_id = tables.id
                ), JSON_ARRAY()) items,
                (
                    SELECT JSON_OBJECT(
                        'id', users.id, 
                        'username', users.username
                    )
                    FROM users 
                    WHERE users.id = tables.user_id
                ) user
            FROM tables
            WHERE event_id = ?
            AND id NOT IN (SELECT table_id FROM table_master_table)
            ORDER BY table_name, master_table_name`, [eventId, eventId, eventId])
    }

    async getActiveTable(eventId: number): Promise<Table[]> {
        return await db.query(`
            SELECT tables.id, tables.name, tables.paid, tables.status,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', items.id, 
                    'master_item_id', items.master_item_id, 
                    'event_id', items.event_id,
                    'table_id', items.table_id,
                    'order_id', items.order_id,
                    'note', items.note, 
                    'name', items.name, 
                    'type', IFNULL(types.name, items.type), 
                    'icon', IFNULL(sub_types.icon, items.icon), 
                    'sub_type', IFNULL(sub_types.name, items.sub_type), 
                    'price', items.price,
                    'destination_id', items.destination_id,
                    'done', items.done,
                    'paid', items.paid
                )) 
                FROM items 
                LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
                LEFT JOIN types ON sub_types.type_id = types.id
                WHERE table_id = tables.id
            ) items,
            (
                SELECT JSON_OBJECT(
                    'id', users.id, 
                    'username', users.username
                )
                FROM users 
                WHERE users.id = tables.user_id
            ) user
            FROM tables 
            WHERE event_id = ?
            ORDER BY paid, tables.id
            `, [eventId])
    }

    async getLayout(eventId: number): Promise<RestaurantLayout> {
        const rooms = await db.query<Room>('SELECT * FROM rooms WHERE status = ?', ['ACTIVE'])
        return {
            rooms,
            tables: await this.getAvailableTableV2(eventId)
        } as RestaurantLayout
    }

    async getTableItems(tableId: number, eventId: number): Promise<Event> {
        return await db.queryOne<Event>(`
            SELECT tables.id, tables.name, tables.paid, tables.status,
            IFNULL((
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', items.id, 
                    'master_item_id', items.master_item_id, 
                    'event_id', items.event_id,
                    'table_id', items.table_id,
                    'order_id', items.order_id,
                    'note', items.note, 
                    'name', items.name, 
                    'type', IFNULL(types.name, items.type), 
                    'icon', IFNULL(sub_types.icon, items.icon), 
                    'sub_type', IFNULL(sub_types.name, items.sub_type), 
                    'price', items.price,
                    'destination_id', items.destination_id,
                    'done', items.done,
                    'paid', items.paid,
                    'setMinimum', items.setMinimum
                )) 
                FROM items 
                LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
                LEFT JOIN types ON sub_types.type_id = types.id
                WHERE table_id = tables.id
            ), JSON_ARRAY()) items,
            (
                SELECT JSON_OBJECT(
                    'id', users.id, 
                    'username', users.username
                )
                FROM users 
                WHERE users.id = tables.user_id
            ) user
            FROM tables 
            WHERE tables.id = ? AND event_id = ?
            ORDER BY paid, tables.id`
            , [tableId, eventId])
    }

    async saveLayout(layout: RestaurantLayout, event_id: number): Promise<number> {
        let transactionQueries: [string] = ['UPDATE master_tables_event SET status = ? WHERE event_id = ?']
        let transactionParams: [any[]] = [['DELETED', event_id]]
        layout.tables.filter(t => layout.rooms.map(r => r.id).includes(t.room_id)).forEach(async t => {
            const params = [t.default_seats, 'ACTIVE', t.room_id, t.x, t.y, t.width, t.height, t.shape, event_id]
            if (t.id !== undefined && t.id < 0) {
                transactionQueries.push(`INSERT INTO master_tables_event 
                    (name, default_seats, status, room_id, x, y, width, height, shape, event_id) VALUES (?,?,?,?,?,?,?,?,?,?)`)
                transactionParams.push([t.name || t.master_table_name, ...params])
            } else {
                transactionQueries.push(`UPDATE master_tables_event SET name = ?, default_seats = ?, status = ?, room_id = ?, x = ?, y = ?, width = ?, height = ?, shape = ? 
                    WHERE event_id = ? AND id = ?`)
                transactionParams.push([t.master_table_name, ...params, t.id])
                if (t.table_name !== t.master_table_name) {
                    transactionQueries.push(`UPDATE tables SET name = ? WHERE tables.id = ?`)
                    transactionParams.push([t.master_table_name, t.table_id])
                }
            }
        })

        await db.executeTransaction(transactionQueries, transactionParams)

        SocketIOService.instance().sendMessage({
            rooms: ["waiter", "bartender", "table", "checkoutS"],
            event: "reload-table",
            body: {}
        })

        return 1
    }

    async getAll(): Promise<Table[]> {
        return await db.query('SELECT * FROM tables', [])
    }

    async get(id: number): Promise<Table[]> {
        return await db.query('SELECT * FROM tables WHERE ID = ?', [id])
    }

    async create(table: Table, userId: number): Promise<number> {
        const table_id = await db.executeInsert('INSERT INTO tables (name, event_id, status, user_id) VALUES (?,?,?)', [table.name, table.event_id, 'ACTIVE', userId])
        if (table.master_table_id) {
            const transactionInput: { queries: string[], values: any[] } = {
                queries: [],
                values: []
            }
            for (let i = 0; i < table.master_table_id.length; i++) {
                transactionInput.queries.push('INSERT INTO table_master_table (table_id, master_table_id) VALUES (?, ?)')
                transactionInput.values.push([table_id, table.master_table_id[i]])
            }
            await db.executeTransaction(transactionInput.queries, transactionInput.values)
        }
        return table_id
    }

    async delete(id: number): Promise<number> {
        return db.executeTransaction([
            'DELETE FROM items WHERE table_id = ?',
            'DELETE FROM orders WHERE table_id = ?',
            'DELETE FROM tables WHERE id = ?'
        ], [
            [id],
            [id],
            [id]
        ])
    }

    async update(table: Table, id: number): Promise<number> {
        return await db.executeUpdate('UPDATE tables SET STATUS = ? WHERE id = ?', [table.status, id])
    }

    async closeTable(table_id: number): Promise<number> {
        const result = await db.executeTransaction([
            'UPDATE items SET paid = TRUE WHERE table_id = ?',
            'UPDATE tables SET status = "CLOSED", paid = TRUE WHERE id = ?',
            'DELETE FROM table_master_table WHERE table_id = ?'
        ], [
            [table_id],
            [table_id],
            [table_id]
        ])
        SocketIOService.instance().sendMessage({
            rooms: ["waiter", "table", "checkout"],
            event: "reload-table",
            body: {}
        })
        return result
    }

    async paySelectedItem(table_id: number, item_ids: number[]): Promise<number> {
        return await db.executeUpdate(`UPDATE items SET paid = TRUE WHERE table_id = ? AND id IN (${item_ids.join(',')})`, [table_id])
    }

    async insertMultipleTables(event_id: number, tableNames: string[], userId: number): Promise<number> {
        if (tableNames.length) {
            const result = await db.executeTransaction(
                tableNames.map(() => `INSERT INTO tables (event_id, name, user_id) VALUES (?,?,?)`),
                tableNames.map((name:string) => [event_id, name, userId])
            )

            SocketIOService.instance().sendMessage({
                rooms: ["waiter", "table", "checkout"],
                event: "reload-table",
                body: {}
            })

            return result
        }
        return 0
    }
}

const tableApi = new TableApi()
export default tableApi