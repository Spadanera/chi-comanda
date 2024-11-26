import db from "../db"
import { MasterTable, Table } from "../../../models/src"
import { SocketIOService } from "../socket"

class TableApi {
    constructor() {
    }

    async getFreeTable(eventId: number): Promise<MasterTable[]> {
        return await db.query(`
            SELECT 
            master_tables.id table_id, 
            master_tables.name table_name
            FROM master_tables
            WHERE id NOT IN (
				SELECT master_table_id from table_master_table
				WHERE table_id IN (
					SELECT id FROM tables WHERE event_id = ? AND status = 'ACTIVE'
				)
            )
            `, [eventId])
    }

    async changeTable(table_id: number, master_table_id: number): Promise<number> {
        const table_name = (await db.queryOne<MasterTable>("SELECT name FROM master_tables WHERE id = ?", [master_table_id])).name
        const result = await db.executeTransaction([
            "UPDATE table_master_table SET master_table_id = ? WHERE table_id = ?",
            "UPDATE tables SET name = ? WHERE id = ?"
        ], [
            [master_table_id, table_id],
            [table_name, table_id]
        ])
        SocketIOService.instance().sendMessage({
            rooms: ["waiter", "bartender"],
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
            master_tables.name master_table_name, 
            master_tables.default_seats,
            available_tables.event_id
            FROM (SELECT tables.id, tables.name, table_master_table.master_table_id, tables.event_id
                FROM tables
                INNER JOIN table_master_table ON tables.id = table_master_table.table_id
                WHERE tables.status = 'ACTIVE' AND tables.event_id = ?) available_tables
            RIGHT JOIN master_tables ON available_tables.master_table_id = master_tables.id
            WHERE master_tables.status = 'ACTIVE'
            UNION
            SELECT 
                tables.id table_id, 
                tables.name table_name, 
                null master_table_id, 
                null master_table_name,
                null default_seats,
                tables.event_id
            FROM tables
            WHERE tables.status = 'ACTIVE' AND event_id = ?
            AND id NOT IN (SELECT table_id FROM table_master_table)
            ORDER BY table_name DESC, master_table_name`, [eventId, eventId])
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

    async getAll(): Promise<Table[]> {
        return await db.query('SELECT * FROM tables', [])
    }

    async get(id: number): Promise<Table[]> {
        return await db.query('SELECT * FROM tables WHERE ID = ?', [id])
    }

    async create(table: Table, userId: number): Promise<number> {
        const table_id = await db.executeInsert('INSERT INTO tables (name, event_id, status, user_id) VALUES (?,?,?)', [table.name, table.event_id, 'ACTIVE', userId])
        if (table.master_table_id) {
            const transactionInput: { queries: string[], values: any[]} = {
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
            'UPDATE tables SET status = "CLOSED", paid = TRUE WHERE id = ?'
        ], [
            [table_id],
            [table_id]
        ])
        SocketIOService.instance().sendMessage({
            room: "waiter",
            event: "reload-table",
            body: {}
        })
        return result
    }

    async paySelectedItem(table_id: number, item_ids: number[]): Promise<number> {
        return await db.executeUpdate(`UPDATE items SET paid = TRUE WHERE table_id = ? AND id IN (${item_ids.join(',')})`, [table_id])
    }
}

const tableApi = new TableApi()
export default tableApi