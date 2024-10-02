import DB from "../db/index"
import { AvailableTable, MasterTable, Table } from "../models/index"

export default class TableApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAvailableTable(eventId: number): Promise<MasterTable[]> {
        return await this.database.query('SELECT * FROM AvailableTables WHERE event_id = ? OR event_id IS NULL ORDER BY event_id, master_table_name', [eventId])
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
            await this.database.execute('UPDATE items SET paid = TRUE WHERE table_id = ?', [table_id])
            return await this.database.execute('UPDATE tables SET status = "CLOSED" WHERE id = ?', [table_id])
        })
    }
}