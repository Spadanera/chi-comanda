import db from "../db"
import { Item, Order, CompleteOrderInput, User } from "../../../models/src"
import { SocketIOService } from "../socket"
import tableApi from "./table"
import { getCurrentDateTimeInItaly } from "../utils/helper"

class OrderAPI {
    constructor() {
    }

    async getAll(event_id: number, destinationIds: number[]): Promise<Order[]> {
        const destinationIdsString = destinationIds.join(',');
        return await db.query(`
            SELECT * FROM (
                SELECT 
                    orders.id, 
                    orders.event_id,
                    orders.table_id, 
                    orders.order_date,
                    tables.name table_name,
                    (CASE WHEN (
                        SELECT COUNT(items.id) FROM items 
                        WHERE order_id = orders.id AND items.destination_id IN (${destinationIdsString}) AND IFNULL(done, FALSE) = FALSE
                    ) > 0 THEN 0 ELSE 1 END) done,  
                    (
                        SELECT JSON_ARRAYAGG(JSON_OBJECT(
                            'id', items.id, 
                            'master_item_id', items.master_item_id, 
                            'note', items.note, 
                            'name', items.name, 
                            'order_id', items.order_id, 
                            'type', IFNULL(types.name, items.type), 
                            'icon', IFNULL(sub_types.icon, items.icon), 
                            'sub_type', IFNULL(sub_types.name, items.sub_type), 
                            'price', items.price,
                            'destination_id', items.destination_id,
                            'done', items.done,
                            'paid', items.paid
                        )) 
                        FROM items 
                        LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
                        LEFT JOIN types ON sub_types.type_id = types.id
                        WHERE order_id = orders.id AND items.destination_id IN (${destinationIdsString})
                    ) items,
                    (
					    SELECT JSON_OBJECT(
                            'id', users.id, 
                            'username', users.username
                        )
                        FROM users 
                        WHERE users.id = orders.user_id
                    ) user
                FROM orders 
                INNER JOIN tables ON orders.table_id = tables.id
                WHERE orders.event_id = ?
            ) pivot
            WHERE pivot.items != '[]'
            ORDER BY pivot.done, pivot.id`, [event_id])
    }

    async get(id: number): Promise<Order[]> {
        return await db.query('SELECT * FROM orders WHERE ID = ?', [id])
    }

    async create(order: Order, userId: number): Promise<number> {
        if (!order.table_id) {
            order.table_id = await db.executeInsert('INSERT INTO tables (name, event_id, status) VALUES (?, ?, ?)', [order.table_name, order.event_id, 'ACTIVE'])
            if (order.master_table_id) {
                await db.executeInsert('INSERT INTO table_master_table (table_id, master_table_id) VALUES (?, ?)', [order.table_id, order.master_table_id])
            }
        }
        order.order_date = getCurrentDateTimeInItaly()
        const order_id = await db.executeInsert('INSERT INTO orders (event_id, table_id, order_date, user_id) VALUES (?,?,?,?)'
            , [order.event_id, order.table_id, order.order_date, userId])
        if (order.items) {
            for (let i = 0; i < order.items.length; i++) {
                let item = order.items[i]
                order.items[i].id = await db.executeInsert(`
                    INSERT INTO items 
                    (event_id, order_id, table_id, master_item_id, type, sub_type, name, price, note, destination_id, icon, done, paid) 
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
                    , [
                        order.event_id, order_id, order.table_id, item.master_item_id, item.type, item.sub_type, item.name, item.price, item.note || ''
                        , item.destination_id, item.icon, item.done, item.paid
                    ])
            }
            if (order.items.length && order.items[0].done) {
                await this.completeOrder(order_id, { item_ids: [] })
            }
        }
        if (userId) {
            const user: User = await db.queryOne<User>('SELECT id, username, avatar FROM users WHERE id = ?', [userId])
            if (user && user.id) {
                order.user = user
            }
        }
        order.id = order_id
        SocketIOService.instance().sendMessage({
            room: "bartender",
            event: "new-order",
            body: order
        })

        const table = (await tableApi.getActiveTable(order.event_id || 0)).find(t => t.id === order.table_id)
        SocketIOService.instance().sendMessage({
            room: "checkout",
            event: "new-order",
            body: table
        })

        SocketIOService.instance().sendMessage({
            room: "waiter",
            event: "reload-table",
            body: {}
        })

        return order.table_id || 0
    }

    async completeOrder(order_id: number, input: CompleteOrderInput): Promise<number> {
        let result: any
        if (input.item_ids && input.item_ids.length) {
            result = await db.executeUpdate(`UPDATE items SET done = TRUE WHERE order_id = ? AND id in (${input.item_ids.join(',')})`, [order_id])
            const items = await db.query<Item>("SELECT id FROM items WHERE order_id = ? AND IFNULL(done, false) = FALSE", [order_id])
            if (items.length === 0) {
                await db.executeUpdate("UPDATE orders SET done = TRUE WHERE id = ?", [order_id])
            }
        }
        else {
            result = await db.executeUpdate("UPDATE orders SET done = TRUE WHERE id = ?", [order_id])
        }

        SocketIOService.instance().sendMessage({
            room: "checkout",
            event: "order-completed",
            body: { ...input, order_id }
        })

        SocketIOService.instance().sendMessage({
            room: "bartender",
            event: "order-completed",
            body: {}
        })

        return result
    }

    async delete(id: number): Promise<number> {
        return await db.executeTransaction([
            'DELETE FROM items WHERE order_id = ?',
            'DELETE FROM orders WHERE id = ?'
        ], [
            [id],
            [id]
        ])
    }

    async update(order: Order, id: number): Promise<number> {
        return await db.executeUpdate('UPDATE orders SET done = ? WHERE id = ?', [order.done, id])
    }
}

const orderApi = new OrderAPI()
export default orderApi