import DB from "@/db/index"
import { Item, MasterItem } from "@models"

export default class MasterItemsApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<Item[]> {
        return await this.database.query('SELECT * FROM master_items', [])
    }

    async getAllAvailable(): Promise<Item[]> {
        return await this.database.query('SELECT * FROM master_items WHERE available = TRUE', [])
    }

    async get(id: number): Promise<Item[]> {
        return await this.database.query('SELECT * FROM master_items WHERE ID = ?', [id])
    }

    async create(item: MasterItem): Promise<number> {
        return await this.database.execute('INSERT INTO master_items (name, type, sub_type, price, destination_id, available) VALUES (?, ?, ?, ?, ?, ?)'
            , [item.name, item.type, item.sub_type, item.price, item. destination_id, item.available])
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM master_items WHERE id = ?', [id])
    }

    async update(item: MasterItem): Promise<number> {
        return await this.database.execute('UPDATE master_items SET name = ?, type = ?, sub_type = ?, price = ?, destination_id = ? WHERE id = ?'
            , [item.name, item.type, item.sub_type, item.price, item.destination_id, item.id])
    }
}