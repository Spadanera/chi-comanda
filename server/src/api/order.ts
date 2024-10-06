import DB from "../db"
import { Item, Order } from "../../../models/src"

export default class OrderAPI {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(id: number): Promise<Order[]> {
        return await this.database.query('SELECT * FROM orders WHERE event_id = ?', [id])
    }

    async get(id: number): Promise<Order[]> {
        return await this.database.query('SELECT * FROM orders WHERE ID = ?', [id])
    }

    async create(order: Order): Promise<number> {
        return await this.database.executeTransaction(async () => {
            if (!order.table_id && order.master_table_id) {
                order.table_id = await this.database.execute('INSERT INTO tables (name, event_id, status) VALUES (?, ?, ?)', [order.table_name, order.event_id, 'ACTIVE'], true)
                await this.database.execute('INSERT INTO table_master_table (table_id, master_table_id) VALUES (?, ?)', [order.table_id, order.master_table_id], true)
            }
            const order_id = await this.database.execute('INSERT INTO orders (event_id, table_id) VALUES (?,?)', [order.event_id, order.table_id], true)
            if (order.items) {
                for (let i = 0; i < order.items.length; i++) {
                    let item = order.items[i]
                    await this.database.execute('INSERT INTO items (order_id, table_id, master_item_id, note) VALUES (?,?,?,?)'
                        , [order_id, item.table_id, item.master_item_id, item.note], true)
                }
            }
            return order_id
        })
    }

    async updateItems(item: Item, id: number): Promise<number> {
        return await this.database.execute('UPDATE items SET done = ? WHERE order_id = ?', [item.done, id])
    }

    async delete(id: number): Promise<number> {
        return await this.database.executeTransaction(async () => {
            await this.database.execute('DELETE FROM items WHERE order_id = ?', [id])
            return await this.database.execute('DELETE FROM orders WHERE id = ?', [id])
        })
    }

    async update(order: Order, id: number): Promise<number> {
        return await this.database.execute('UPDATE orders SET done = ? WHERE id = ?', [order.done, id])
    }
}