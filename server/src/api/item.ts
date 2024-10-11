import DB from "../db"
import { Item } from "../../../models/src"
import { SocketIOService } from "../socket"

export default class ItemsApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getByOrderId(orderId: number): Promise<Item[]> {
        return await this.database.query('SELECT * FROM items WHERE order_id = ?', [orderId])
    }

    async getByTableId(tableId: number): Promise<Item[]> {
        return await this.database.query('SELECT * FROM items WHERE table_id = ?', [tableId])
    }

    async get(id: number): Promise<Item[]> {
        return await this.database.query('SELECT * FROM items WHERE ID = ?', [id])
    }

    async delete(id: number): Promise<number> {
        const result = await this.database.execute('DELETE FROM items WHERE id = ?', [id])
        SocketIOService.instance().sendMessage({
            rooms: ["bar", "checkout"],
            event: "item-removed",
            body: id
        })
        return result
    }

    async update(item: Item): Promise<number> {
        return await this.database.execute('UPDATE items SET DONE = ?, PAID = ? WHERE id = ?', [item.done, item.paid, item.id])
    }
}