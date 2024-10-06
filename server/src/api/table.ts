import DB from "../db"
import { MasterTable, Table } from "../../../models/src"

export default class TableApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAvailableTable(eventId: number): Promise<MasterTable[]> {
        return await this.database.query('SELECT * FROM AvailableTables WHERE event_id = ? OR event_id IS NULL ORDER BY table_name DESC, master_table_name', [eventId])
    }

    async getActiveTable(eventId: number): Promise<MasterTable[]> {
        return await this.database.query(`
            SELECT tables.id, master_tables.name, tables.paid, tables.status, master_tables.id master_table_id,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', items.id, 
                    'master_item_id', master_items.id, 
                    'note', items.note, 
                    'name', master_items.name, 
                    'type', master_items.type, 
                    'sub_type', master_items.sub_type, 
                    'price', master_items.price,
                    'destination_id', master_items.destination_id,
                    'done', items.done,
                    'paid', items.paid
                )) 
                FROM items 
                INNER JOIN master_items ON master_items.id = items.master_item_id
                WHERE table_id = tables.id AND done = TRUE
            ) items
            FROM tables 
            INNER JOIN table_master_table ON tables.id = table_master_table.table_id
            INNER JOIN master_tables ON master_tables.id = table_master_table.master_table_id
            WHERE event_id = ? AND status = 'ACTIVE'
            ORDER BY tables.id
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
}