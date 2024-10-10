import DB from "../db"
import { Item, MasterItem } from "../../../models/src"

export default class MasterItemsApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<Item[]> {
        return await this.database.query(`SELECT master_items.*, destinations.name destination
            FROM master_items
            INNER JOIN destinations ON master_items.destination_id = destinations.id
            WHERE status = 'ACTIVE'`
            , [])
    }

    async getAllAvailable(): Promise<Item[]> {
        return await this.database.query('SELECT * FROM master_items WHERE available = TRUE AND status = "ACTIVE"', [])
    }

    async get(id: number): Promise<Item[]> {
        return await this.database.query('SELECT * FROM master_items WHERE ID = ?', [id])
    }

    async create(item: MasterItem): Promise<number> {
        return await this.database.execute('INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
            , [item.name, item.type, item.sub_type, item.price, item.destination_id, item.available, item.status])
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM master_items WHERE id = ?', [id])
    }

    async update(item: MasterItem): Promise<number> {
        return await this.database.execute('UPDATE master_items SET name = ?, type = ?, sub_type = ?, price = ?, destination_id = ?, available = ?, status = ? WHERE id = ?'
            , [item.name, item.type, item.sub_type, item.price, item.destination_id, item.available, item.status, item.id])
    }
}