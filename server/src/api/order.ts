import DB from "../db"
import { Order } from "../../../models/src"

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
                master_tables.name table_name,
                master_tables.id master_table_id,
                orders.done, 
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', items.id, 
                        'master_item_id', master_items.id, 
                        'note', items.note, 
                        'name', master_items.name, 
                        'type', master_items.type, 
                        'sub_type', master_items.sub_type, 
                        'price', master_items.price,
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
            INNER JOIN table_master_table ON table_master_table.table_id = tables.id
            INNER JOIN master_tables ON table_master_table.master_table_id = master_tables.id
            WHERE orders.event_id = ?`, [destination_ids, event_id])
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

    async completeOrder(order_id: number): Promise<number> {
        return await this.database.executeTransaction(async () => {
            await this.database.execute('UPDATE items SET done = TRUE WHERE order_id = ?', [order_id], true)
            return await this.database.execute('UPDATE orders SET done = TRUE WHERE id = ?', [order_id], true)
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