import { placeholders } from '../db'
import { CompleteOrderInput, Item, Order, User } from '../../../models/src'
import { notify } from '../socket'
import { ITEM_CATEGORY_JOINS, ITEM_ICON, ITEM_SUB_TYPE, ITEM_TYPE } from '../db/sql'
import { nowInItaly } from '../utils/date'
import { BadRequestError } from '../http/errors'
import tableService from './table'
import pushService from './push'
import { priceOrderItems } from './pricing'
import { VenueContext } from '../venue/context'

class OrderService {
    /** Orders of the event with only the items going to the given destinations (bar, kitchen, ...). */
    async getAll(ctx: VenueContext, eventId: number, destinationIds: number[]): Promise<Order[]> {
        await ctx.db.find('events', eventId, 'id')
        if (!destinationIds.length) return []
        const inDestinations = placeholders(destinationIds)
        return ctx.db.query(`
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
                        WHERE items.venue_id = :venue AND order_id = orders.id AND items.destination_id IN (${inDestinations}) AND IFNULL(done, FALSE) = FALSE
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
                        WHERE items.venue_id = :venue AND order_id = orders.id AND items.destination_id IN (${inDestinations})
                    ) items,
                    (SELECT JSON_OBJECT('id', users.id, 'username', users.username) FROM users WHERE users.id = orders.user_id) user
                FROM orders
                INNER JOIN tables ON tables.venue_id = :venue AND orders.table_id = tables.id
                WHERE orders.venue_id = :venue AND orders.event_id = ?
            ) pivot
            WHERE pivot.items != '[]'
            ORDER BY pivot.done, pivot.id`, [...destinationIds, ...destinationIds, eventId])
    }

    /**
     * Places an order. Without `table_id` a new table is opened (optionally on a layout
     * position). Returns the id of the table the order belongs to.
     */
    async create(ctx: VenueContext, order: Order): Promise<number> {
        const userId = ctx.userId
        const orderDate = nowInItaly()
        let items: Item[] = []

        // An existing table or layout position named by the client must be the venue's (and the event's)
        if (order.table_id) {
            await ctx.db.find('tables', order.table_id, 'id')
            const [table] = await ctx.db.query('SELECT id FROM tables WHERE venue_id = :venue AND id = ? AND event_id = ?',
                [order.table_id, order.event_id])
            if (!table) throw new BadRequestError('Il tavolo non appartiene alla serata')
        } else if (order.master_table_id) {
            await ctx.db.find('master_tables_event', order.master_table_id, 'id')
        }

        const { orderId, tableId } = await ctx.db.transaction(async tx => {
            // Prices, names and destinations are decided here, never trusted from the client
            items = await priceOrderItems(tx, Number(order.event_id), order.items || [])
            order.items = items
            let tableId = order.table_id
            if (!tableId) {
                tableId = await tx.insert(`INSERT INTO tables (venue_id, name, event_id, status, user_id) VALUES (:venue, ?, ?, 'ACTIVE', ?)`,
                    [order.table_name, order.event_id, userId])
                if (order.master_table_id) {
                    await tx.insert('INSERT INTO table_master_table (venue_id, table_id, master_table_id) VALUES (:venue, ?, ?)',
                        [tableId, order.master_table_id])
                }
            }
            const orderId = await tx.insert('INSERT INTO orders (venue_id, event_id, table_id, order_date, user_id) VALUES (:venue,?,?,?,?)',
                [order.event_id, tableId, orderDate, userId])
            for (const item of items) {
                item.id = await tx.insert(`
                    INSERT INTO items
                    (venue_id, event_id, order_id, table_id, master_item_id, type, sub_type, sub_type_id, name, price, note, destination_id, icon, done, paid, setMinimum)
                    VALUES (:venue,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    order.event_id, orderId, tableId, item.master_item_id, item.type, item.sub_type, item.sub_type_id, item.name, item.price,
                    item.note, item.destination_id, item.icon, item.done, item.paid, item.setMinimum,
                ])
            }
            return { orderId, tableId }
        })

        // Orders entered already served (e.g. directly at the counter) are completed right away
        if (items.length && items[0].done) {
            await this.complete(ctx, orderId, { item_ids: [] })
        }

        const user = await ctx.db.queryOne<User>('SELECT id, username, avatar FROM users WHERE id = ?', [userId])
        const created: Order = { ...order, id: orderId, table_id: tableId, order_date: orderDate, user }
        const table = (await tableService.getByEvent(ctx, Number(order.event_id))).find(t => t.id === tableId)
        notify.newOrder(created, table)
        notify.tablesChanged(['waiter', 'table'])
        // Not awaited: the waiter doesn't wait for the push services to answer
        void pushService.notifyNewOrder(ctx, created, table?.name || order.table_name || '')

        return tableId
    }

    /** Marks the given items as done (or the whole order when no item is given). */
    async complete(ctx: VenueContext, orderId: number, input: CompleteOrderInput): Promise<number> {
        await ctx.db.find('orders', orderId, 'id')
        let result: number
        if (input.item_ids?.length) {
            result = await ctx.db.transaction(async tx => {
                const affected = await tx.execute(`
                    UPDATE items SET done = TRUE WHERE venue_id = :venue AND order_id = ? AND id IN (${placeholders(input.item_ids)})`,
                    [orderId, ...input.item_ids])
                const pending = await tx.query('SELECT id FROM items WHERE venue_id = :venue AND order_id = ? AND IFNULL(done, FALSE) = FALSE', [orderId])
                if (!pending.length) {
                    await tx.execute('UPDATE orders SET done = TRUE WHERE venue_id = :venue AND id = ?', [orderId])
                }
                return affected
            })
        } else {
            result = await ctx.db.execute('UPDATE orders SET done = TRUE WHERE venue_id = :venue AND id = ?', [orderId])
        }
        notify.orderCompleted({ ...input, order_id: orderId })
        return result
    }
}

export default new OrderService()
