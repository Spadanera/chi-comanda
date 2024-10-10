import DB from "../db"
import { MasterTable } from "../../../models/src"

export default class MasterTableApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<MasterTable[]> {
        return await this.database.query('SELECT * FROM master_tables WHERE status = ?', ['ACTIVE'])
    }

    async get(id: number): Promise<MasterTable[]> {
        return await this.database.query('SELECT * FROM master_tables WHERE ID = ?', [id])
    }

    async create(table: MasterTable): Promise<number> {
        return await this.database.execute('INSERT INTO master_tables (name, default_seats, status) VALUES (?, ?, ?)'
            , [table.name, table.default_seats, table.status])
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM master_tables WHERE id = ?', [id])
    }

    async update(table: MasterTable): Promise<number> {
        return await this.database.execute('UPDATE master_tables SET name = ?, default_seats = ?, status = ? WHERE id = ?'
            , [table.name, table.default_seats, table.status, table.id])
    }
}