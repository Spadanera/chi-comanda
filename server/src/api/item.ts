import DB from "../db/index"
import { Item } from "../models/index"

export default class TableApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(orderId: number): Promise<Item[]> {
        return await this.database.query('SELECT * FROM items WHERE order_id = ?', [orderId])
    }

    async get(id: number): Promise<Item[]> {
        return await this.database.query('SELECT * FROM items WHERE ID = ?', [id])
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM tables WHERE id = ?', [id])
    }

    async update(item: Item, id: number): Promise<number> {
        return await this.database.execute('UPDATE items SET DONE = ?, PAID WHERE id = ?', [item.done, item.paid, id])
    }
}