import db, { placeholders } from '../db'
import { CompleteOrderInput, Order, User } from '../../../models/src'
import { notify } from '../socket'
import { ITEM_CATEGORY_JOINS, ITEM_ICON, ITEM_SUB_TYPE, ITEM_TYPE } from '../db/sql'
import { nowInItaly } from '../utils/date'
import tableService from './table'

class OrderService {
    /** Orders of the event with only the items going to the given destinations (bar, kitchen, ...). */
    getAll(eventId: number, destinationIds: number[]): Promise<Order[]> {
        if (!destinationIds.length) return Promise.resolve([])
        const inDestinations = placeholders(destinationIds)
        return db.query(`
            SELECT * FROM (
                SELECT
                    orders.id,
                    orders.event_id,
                    orders.table_id,
                    -- Stored as Italian wall-clock time: sent as text so the server timezone can't shift it
                    DATE_FORMAT(orders.order_date, '%Y-%m-%d %H:%i:%s') order_date,
                    tables.name table_name,
                    (CASE WHEN (
                        SELECT COUNT(items.id) FROM items
                        WHERE order_id = orders.id AND items.destination_id IN (${inDestinations}) AND IFNULL(done, FALSE) = FALSE
                    ) > 0 THEN 0 ELSE 1 END) done,
                    (
                        SELECT JSON_ARRAYAGG(JSON_OBJECT(
                            'id', items.id,
                            'master_item_id', items.master_item_id,
                            'note', items.note,
                            'name', items.name,
                            'order_id', items.order_id,
                            'type', ${ITEM_TYPE},
                            'icon', ${ITEM_ICON},
                            'sub_type', ${ITEM_SUB_TYPE},
                            'price', items.price,
                            'destination_id', items.destination_id,
                            'done', items.done,
                            'paid', items.paid
                        ))
                        FROM items
                        ${ITEM_CATEGORY_JOINS}
                        WHERE order_id = orders.id AND items.destination_id IN (${inDestinations})
                    ) items,
                    (SELECT JSON_OBJECT('id', users.id, 'username', users.username) FROM users WHERE users.id = orders.user_id) user
                FROM orders
                INNER JOIN tables ON orders.table_id = tables.id
                WHERE orders.event_id = ?
            ) pivot
            WHERE pivot.items != '[]'
            ORDER BY pivot.done, pivot.id`, [...destinationIds, ...destinationIds, eventId])
    }

    /**
     * Places an order. Without `table_id` a new table is opened (optionally on a layout
     * position). Returns the id of the table the order belongs to.
     */
    async create(order: Order, userId: number): Promise<number> {
        const items = order.items || []
        const orderDate = nowInItaly()

        const { orderId, tableId } = await db.transaction(async tx => {
            let tableId = order.table_id
            if (!tableId) {
                tableId = await tx.insert(`INSERT INTO tables (name, event_id, status, user_id) VALUES (?, ?, 'ACTIVE', ?)`,
                    [order.table_name, order.event_id, userId])
                if (order.master_table_id) {
                    await tx.insert('INSERT INTO table_master_table (table_id, master_table_id) VALUES (?, ?)', [tableId, order.master_table_id])
                }
            }
            const orderId = await tx.insert('INSERT INTO orders (event_id, table_id, order_date, user_id) VALUES (?,?,?,?)',
                [order.event_id, tableId, orderDate, userId])
            for (const item of items) {
                item.id = await tx.insert(`
                    INSERT INTO items
                    (event_id, order_id, table_id, master_item_id, type, sub_type, name, price, note, destination_id, icon, done, paid, setMinimum)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    order.event_id, orderId, tableId, item.master_item_id, item.type, item.sub_type, item.name, item.price,
                    item.note || '', item.destination_id, item.icon, item.done, item.paid, item.setMinimum,
                ])
            }
            return { orderId, tableId }
        })

        // Orders entered already served (e.g. directly at the counter) are completed right away
        if (items.length && items[0].done) {
            await this.complete(orderId, { item_ids: [] })
        }

        const user = await db.queryOne<User>('SELECT id, username, avatar FROM users WHERE id = ?', [userId])
        const created: Order = { ...order, id: orderId, table_id: tableId, order_date: orderDate, user }
        const table = (await tableService.getByEvent(order.event_id || 0)).find(t => t.id === tableId)
        notify.newOrder(created, table)
        notify.tablesChanged(['waiter', 'table'])

        return tableId
    }

    /** Marks the given items as done (or the whole order when no item is given). */
    async complete(orderId: number, input: CompleteOrderInput): Promise<number> {
        let result: number
        if (input.item_ids?.length) {
            result = await db.transaction(async tx => {
                const affected = await tx.execute(`UPDATE items SET done = TRUE WHERE order_id = ? AND id IN (${placeholders(input.item_ids)})`,
                    [orderId, ...input.item_ids])
                const pending = await tx.query('SELECT id FROM items WHERE order_id = ? AND IFNULL(done, FALSE) = FALSE', [orderId])
                if (!pending.length) {
                    await tx.execute('UPDATE orders SET done = TRUE WHERE id = ?', [orderId])
                }
                return affected
            })
        } else {
            result = await db.execute('UPDATE orders SET done = TRUE WHERE id = ?', [orderId])
        }
        notify.orderCompleted({ ...input, order_id: orderId })
        return result
    }
}

export default new OrderService()
