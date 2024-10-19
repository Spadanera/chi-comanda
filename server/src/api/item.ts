import db from "../utils/db"
import { Item } from "../../../models/src"
import { SocketIOService } from "../socket"

class ItemApi {
    constructor() {
    }

    async getByOrderId(orderId: number): Promise<Item[]> {
        return await db.query('SELECT * FROM items WHERE order_id = ?', [orderId])
    }

    async getByTableId(tableId: number): Promise<Item[]> {
        return await db.query('SELECT * FROM items WHERE table_id = ?', [tableId])
    }

    async get(id: number): Promise<Item[]> {
        return await db.query('SELECT * FROM items WHERE ID = ?', [id])
    }

    async delete(id: number): Promise<number> {
        const result = await db.executeUpdate('DELETE FROM items WHERE id = ?', [id])
        SocketIOService.instance().sendMessage({
            rooms: ["bar", "checkout"],
            event: "item-removed",
            body: id
        })
        return result
    }

    async update(item: Item): Promise<number> {
        const result = await db.executeUpdate('UPDATE items SET DONE = ?, PAID = ? WHERE id = ?', [item.done, item.paid, item.id])

        SocketIOService.instance().sendMessage({
            rooms: ["bar"],
            event: "item-updated",
            body: item
        })

        return result
    }
}

const itemApi = new ItemApi()
export default itemApi