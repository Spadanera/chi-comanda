import db from "../db"
import { Item } from "../../../models/src"
import { SocketIOService } from "../socket"

class ItemApi {
    constructor() {
    }

    async getByOrderId(orderId: number): Promise<Item[]> {
        return await db.query(`
            SELECT items.id, items.event_id, event.table_id, items.order_id, 
            items.master_item_id, IFNULL(types.name, items.type) type, IFNULL(sub_types.name, items.sub_type) sub_type,
            IFNULL(sub_types.icon, items.icon) icon, items.name, items.price, items.note, items.done, items.paid, items.destination_id 
            FROM items 
            LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
            LEFT JOIN types ON sub_types.type_id = types.id
            WHERE order_id = ?`, [orderId])
    }

    async getByTableId(tableId: number): Promise<Item[]> {
        return await db.query(` 
            SELECT items.id, items.event_id, event.table_id, items.order_id, 
            items.master_item_id, IFNULL(types.name, items.type) type, IFNULL(sub_types.name, items.sub_type) sub_type,
            IFNULL(sub_types.icon, items.icon) icon, items.name, items.price, items.note, items.done, items.paid, items.destination_id 
            FROM items 
            LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
            LEFT JOIN types ON sub_types.type_id = types.id
            table_id = ?`, [tableId])
    }

    async get(id: number): Promise<Item[]> {
        return await db.query('SELECT * FROM items WHERE ID = ?', [id])
    }

    async delete(id: number): Promise<number> {
        const result = await db.executeUpdate('DELETE FROM items WHERE id = ?', [id])
        SocketIOService.instance().sendMessage({
            rooms: ["bratender", "checkout"],
            event: "item-removed",
            body: id
        })
        return result
    }

    async update(item: Item): Promise<number> {
        const result = await db.executeUpdate('UPDATE items SET DONE = ?, PAID = ? WHERE id = ?', [item.done, item.paid, item.id])

        SocketIOService.instance().sendMessage({
            rooms: ["bartender"],
            event: "item-updated",
            body: item
        })

        return result
    }
}

const itemApi = new ItemApi()
export default itemApi