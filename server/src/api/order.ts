import DB from "../db"
import { Item, Order, CompleteOrderInput } from "../../../models/src"
import { SocketIOService } from "../socket"
import TableApi from "./table"

export default class OrderAPI {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(event_id: number, destination_ids: number[]): Promise<Order[]> {
        return await this.database.query(`
            SELECT 
                orders.id, 
                orders.event_id,
                orders.table_id, 
                tables.name table_name,
                (CASE WHEN (
					SELECT COUNT(items.id) FROM items 
                    INNER JOIN master_items ON master_items.id = items.master_item_id
                    WHERE order_id = orders.id AND master_items.destination_id IN (?) AND IFNULL(done, FALSE) = FALSE
				) > 0 THEN 0 ELSE 1 END) done,  
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', items.id, 
                        'master_item_id', master_items.id, 
                        'note', items.note, 
                        'name', items.name, 
                        'type', master_items.type, 
                        'sub_type', master_items.sub_type, 
                        'price', items.price,
                        'destination_id', master_items.destination_id,
                        'done', items.done,
                        'paid', items.paid
                    )) 
                    FROM items 
                    INNER JOIN master_items ON master_items.id = items.master_item_id
                    WHERE order_id = orders.id AND master_items.destination_id IN (?)
                ) items
            FROM orders 
            INNER JOIN tables ON orders.table_id = tables.id
            WHERE orders.event_id = ?
            ORDER BY done, orders.id`, [destination_ids, destination_ids, event_id])
    }

    async get(id: number): Promise<Order[]> {
        return await this.database.query('SELECT * FROM orders WHERE ID = ?', [id])
    }

    async create(order: Order): Promise<number> {
        const table_id = await this.database.executeTransaction(async () => {
            if (!order.table_id) {
                order.table_id = await this.database.execute('INSERT INTO tables (name, event_id, status) VALUES (?, ?, ?)', [order.table_name, order.event_id, 'ACTIVE'], true)
                if (order.master_table_id) {
                    await this.database.execute('INSERT INTO table_master_table (table_id, master_table_id) VALUES (?, ?)', [order.table_id, order.master_table_id], true)
                }
            }
            const order_id = await this.database.execute('INSERT INTO orders (event_id, table_id) VALUES (?,?)', [order.event_id, order.table_id], true)
            if (order.items) {
                for (let i = 0; i < order.items.length; i++) {
                    let item = order.items[i]
                    order.items[i].id = await this.database.execute('INSERT INTO items (event_id, order_id, table_id, master_item_id, name, price, note) VALUES (?,?,?,?,?,?,?)'
                        , [order.event_id, order_id, order.table_id, item.master_item_id, item.name, item.price, item.note], true)
                }
            }
            order.id = order_id
            SocketIOService.instance().sendMessage({
                room: "bar",
                event: "new-order",
                body: order
            })

            return order.table_id || 0
        })
        const tableApi = new TableApi()
        const table = (await tableApi.getActiveTable(order.event_id || 0)).find(t => t.id === table_id)
        SocketIOService.instance().sendMessage({
            room: "checkout",
            event: "new-order",
            body: table
        })

        return table_id;
    }

    async completeOrder(order_id: number, input: CompleteOrderInput): Promise<number> {
        return await this.database.executeTransaction(async () => {
            if (input.item_ids && input.item_ids.length) {
                const result = await this.database.execute('UPDATE items SET done = TRUE WHERE order_id = ? AND id in (?)', [order_id, input.item_ids], true)
                const items = await this.database.query<Item>("SELECT id FROM items WHERE order_id = ? AND IFNULL(done, false) = FALSE", order_id)
                if (items.length === 0) {
                    await this.database.execute("UPDATE orders SET done = TRUE WHERE id = ?", [order_id], true)
                }
                return result
            }
            else {
                return await this.database.execute("UPDATE orders SET done = TRUE WHERE id = ?", [order_id], true)
            }
        })
    }

    async delete(id: number): Promise<number> {
        return await this.database.executeTransaction(async () => {
            await this.database.execute('DELETE FROM items WHERE order_id = ?', [id], true)
            return await this.database.execute('DELETE FROM orders WHERE id = ?', [id], true)
        })
    }

    async update(order: Order, id: number): Promise<number> {
        return await this.database.execute('UPDATE orders SET done = ? WHERE id = ?', [order.done, id])
    }
}