import DB from "../db"
import { MasterTable, Table } from "../../../models/src"

export default class TableApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAvailableTable(eventId: number): Promise<MasterTable[]> {
        return await this.database.query(`SELECT 
            available_tables.id table_id, 
            available_tables.name table_name, 
            master_tables.id master_table_id, 
            master_tables.name master_table_name, 
            master_tables.default_seats,
            available_tables.event_id
            FROM (SELECT tables.id, tables.name, table_master_table.master_table_id, tables.event_id
                FROM tables
                INNER JOIN table_master_table ON tables.id = table_master_table.table_id
                WHERE STATUS = 'ACTIVE' AND tables.event_id = ?) available_tables
            RIGHT JOIN master_tables ON available_tables.master_table_id = master_tables.id
            UNION
            SELECT 
                tables.id table_id, 
                tables.name table_name, 
                null master_table_id, 
                null master_table_name,
                null default_seats,
                tables.event_id
            FROM tables
            WHERE STATUS = 'ACTIVE' AND event_id = ?
            AND id NOT IN (SELECT table_id FROM table_master_table)
            ORDER BY table_name DESC, master_table_name`, [eventId, eventId])
    }

    async getActiveTable(eventId: number): Promise<Table[]> {
        return await this.database.query(`
            SELECT tables.id, tables.name, tables.paid, tables.status,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', items.id, 
                    'master_item_id', master_items.id, 
                    'note', items.note, 
                    'name', items.name, 
                    'type', master_items.type, 
                    'sub_type', master_items.sub_type, 
                    'price', items.price,
                    'destination_id', master_items.destination_id,
                    'done', items.done,
                    'paid', items.paid
                )) 
                FROM items 
                INNER JOIN master_items ON master_items.id = items.master_item_id
                WHERE table_id = tables.id
            ) items
            FROM tables 
            WHERE event_id = ?
            ORDER BY status, tables.id
            `, [eventId])
    }

    async getAll(): Promise<Table[]> {
        return await this.database.query('SELECT * FROM tables', [])
    }

    async get(id: number): Promise<Table[]> {
        return await this.database.query('SELECT * FROM tables WHERE ID = ?', [id])
    }

    async create(table: Table): Promise<number> {
        return await this.database.executeTransaction(async () => {
            const table_id = await this.database.execute('INSERT INTO tables (name, event_id, status) VALUES (?,?)', [table.name, table.event_id, 'ACTIVE'], true)
            if (table.master_table_id) {
                for (let i = 0; i < table.master_table_id.length; i++) {
                    await this.database.execute('INSERT INTO table_master_table (table_id, master_table_id) VALUES (?, ?)', [table_id, table.master_table_id[i]], true)
                }
            }
            return table_id
        })
    }

    async delete(id: number): Promise<number> {
        return this.database.executeTransaction(async () => {
            await this.database.execute('DELETE FROM items WHERE table_id = ?', [id])
            await this.database.execute('DELETE FROM orders WHERE table_id = ?', [id])
            return await this.database.execute('DELETE FROM tables WHERE id = ?', [id])
        })
    }

    async update(table: Table, id: number): Promise<number> {
        return await this.database.execute('UPDATE tables SET STATUS = ? WHERE id = ?', [table.status, id])
    }

    async closeTable(table_id: number): Promise<number> {
        return await this.database.executeTransaction(async () => {
            await this.database.execute('UPDATE items SET paid = TRUE WHERE table_id = ?', [table_id], true)
            return await this.database.execute('UPDATE tables SET status = "CLOSED", paid = TRUE WHERE id = ?', [table_id], true)
        })
    }

    async paySelectedItem(table_id: number, item_ids: number[]): Promise<number> {
        return await this.database.execute('UPDATE items SET paid = TRUE WHERE table_id = ? AND id IN (?)', [table_id, item_ids])
    }
}