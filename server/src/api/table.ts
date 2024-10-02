import DB from "../db/index"
import { Table } from "../models/index"

export default class TableApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<Table[]> {
        return await this.database.query('SELECT * FROM tables', [])
    }

    async get(id: number): Promise<Table[]> {
        return await this.database.query('SELECT * FROM tables WHERE ID = ?', [id])
    }

    async create(table: Table): Promise<number> {
        return await this.database.executeTransaction(async () => {
            const table_id = await this.database.execute('INSERT INTO tables (name, status) VALUES (?,?)', [table.name, 'ACTIVE'], true)
            if (table.master_table_id) {
                for (let i = 0; i < table.master_table_id.length; i++) {
                    await this.database.execute('INSERT INTO table_master_table (table_id, master_table_id) VALUES (?, ?)', [table_id, table.master_table_id[i]], true)
                }
            }
            return table_id
        })
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM tables WHERE id = ?', [id])
    }

    async update(table: Table, id: number): Promise<number> {
        return await this.database.execute('UPDATE tables SET STATUS = ? WHERE id = ?', [table.status, id])
    }

    async closeTable(table: Table): Promise<number> {
        return await this.database.execute('UPDATE tables SET status = "CLOSED" WHERE id = ?', [table.id])
    }
}