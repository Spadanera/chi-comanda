import DB from "../db/index"
import { MasterTable } from "../models/index"

export default class MasterTableApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<MasterTable[]> {
        return await this.database.query('SELECT * FROM master_tables', [])
    }

    async getAllAvailable(): Promise<MasterTable[]> {
        return await this.database.query('SELECT * FROM master_tables WHERE available = TRUE', [])
    }

    async get(id: number): Promise<MasterTable[]> {
        return await this.database.query('SELECT * FROM master_tables WHERE ID = ?', [id])
    }

    async create(table: MasterTable): Promise<number> {
        return await this.database.execute('INSERT INTO master_tables (name, default_seats) VALUES (?, ?)'
            , [table.name, table.default_deats])
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM master_tables WHERE id = ?', [id])
    }

    async update(table: MasterTable): Promise<number> {
        return await this.database.execute('UPDATE master_tables SET name = ?, default_deats = ? WHERE id = ?'
            , [table.name, table.default_deats, table.id])
    }
}