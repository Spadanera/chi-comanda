import db from "../db"
import { Item, Order, CompleteOrderInput } from "../../../models/src"
import { SocketIOService } from "../socket"
import tableApi from "./table"

function getCurrentDateTimeInItaly(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;

    let hour = parts.find(part => part.type === 'hour')?.value;
    const minute = parts.find(part => part.type === 'minute')?.value;
    const second = parts.find(part => part.type === 'second')?.value;

    if (hour === '24') {
        hour = '00'
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) (0\d|1\d|2[0-3]):[0-5]\d:[0-5]\d$/;
    const result = `${year}-${month}-${day} ${hour}:${minute}:${second}`

    if (dateRegex.test(result)) {
        return result
    }
    else {
        return '2024-01-01 00:00:00'
    }
}

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
                            'type', items.type, 
                            'sub_type', items.sub_type, 
                            'price', items.price,
                            'destination_id', items.destination_id,
                            'done', items.done,
                            'paid', items.paid
                        )) 
                        FROM items 
                        WHERE order_id = orders.id AND items.destination_id IN (${destinationIdsString})
                    ) items
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

    async create(order: Order): Promise<number> {
        if (!order.table_id) {
            order.table_id = await db.executeInsert('INSERT INTO tables (name, event_id, status) VALUES (?, ?, ?)', [order.table_name, order.event_id, 'ACTIVE'])
            if (order.master_table_id) {
                await db.executeInsert('INSERT INTO table_master_table (table_id, master_table_id) VALUES (?, ?)', [order.table_id, order.master_table_id])
            }
        }
        order.order_date = getCurrentDateTimeInItaly()
        const order_id = await db.executeInsert('INSERT INTO orders (event_id, table_id, order_date) VALUES (?,?,?)', [order.event_id, order.table_id, order.order_date])
        if (order.items) {
            for (let i = 0; i < order.items.length; i++) {
                let item = order.items[i]
                order.items[i].id = await db.executeInsert(`INSERT INTO items (event_id, order_id, table_id, master_item_id, type, sub_type, name, price, note, destination_id) 
                    VALUES (?,?,?,?,?,?,?,?,?,?)`
                    , [order.event_id, order_id, order.table_id, item.master_item_id, item.type, item.sub_type, item.name, item.price, item.note || '', item.destination_id])
            }
        }
        order.id = order_id
        SocketIOService.instance().sendMessage({
            room: "bar",
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
            room: "bar",
            event: "order-completed",
            body: { }
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