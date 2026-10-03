import { placeholders } from '../db'
import { MasterTable, RestaurantLayout, Room, Table } from '../../../models/src'
import { notify } from '../socket'
import { tableItemsJson, userJson } from '../db/sql'
import { VenueContext } from '../venue/context'
import { VenueDb } from '../venue/db'

/** Tables opened during an event, linked to the event layout through `table_master_table`. */
class TableService {
    /** Layout tables of the event not currently occupied by an active table. */
    async getFree(ctx: VenueContext, eventId: number): Promise<MasterTable[]> {
        await ctx.db.find('events', eventId, 'id')
        return ctx.db.query(`
            SELECT master_tables.id table_id, master_tables.name table_name
            FROM master_tables_event master_tables
            WHERE id NOT IN (
                SELECT master_table_id FROM table_master_table
                WHERE venue_id = :venue
                AND table_id IN (SELECT id FROM tables WHERE venue_id = :venue AND event_id = ? AND status = 'ACTIVE')
            ) AND master_tables.venue_id = :venue AND master_tables.event_id = ? AND master_tables.status = 'ACTIVE'`, [eventId, eventId])
    }

    /**
     * Event layout with each table's items and owner. Closed tables and tables without a
     * layout position get the virtual room ids -1 and 0 respectively.
     */
    async getLayout(ctx: VenueContext, eventId: number): Promise<RestaurantLayout> {
        await ctx.db.find('events', eventId, 'id')
        const rooms = await ctx.db.query<Room>(`SELECT * FROM rooms WHERE venue_id = :venue AND status = 'ACTIVE'`)
        const tables = await ctx.db.query<MasterTable>(`
            SELECT
                available_tables.id table_id,
                available_tables.name table_name,
                master_tables.id master_table_id,
                master_tables.id id,
                master_tables.name master_table_name,
                master_tables.default_seats,
                CASE WHEN IFNULL(available_tables.status, 'ACTIVE') = 'ACTIVE' THEN IFNULL(master_tables.room_id, 0) ELSE -1 END room_id,
                master_tables.x,
                master_tables.y,
                master_tables.width,
                master_tables.height,
                master_tables.shape,
                available_tables.event_id,
                IF(available_tables.id IS NULL, 0, 1) inUse,
                available_tables.status status,
                ${tableItemsJson('available_tables.id')} items,
                ${userJson('available_tables.user_id')} user
            FROM (
                SELECT tables.id, tables.name, table_master_table.master_table_id, tables.event_id, tables.status, tables.user_id
                FROM tables
                LEFT JOIN table_master_table ON table_master_table.venue_id = :venue AND tables.id = table_master_table.table_id
                WHERE tables.venue_id = :venue AND tables.event_id = ? AND (tables.status = 'CLOSED' OR table_master_table.id IS NOT NULL)
            ) available_tables
            RIGHT JOIN master_tables_event master_tables ON available_tables.master_table_id = master_tables.id
            WHERE master_tables.venue_id = :venue AND master_tables.status = 'ACTIVE' AND master_tables.event_id = ?
            UNION
            SELECT
                tables.id table_id,
                tables.name table_name,
                NULL master_table_id,
                NULL id,
                tables.name master_table_name,
                NULL default_seats,
                CASE WHEN status = 'CLOSED' THEN -1 ELSE 0 END room_id,
                NULL x,
                NULL y,
                NULL width,
                NULL height,
                NULL shape,
                tables.event_id,
                1 inUse,
                tables.status status,
                ${tableItemsJson('tables.id')} items,
                ${userJson('tables.user_id')} user
            FROM tables
            WHERE venue_id = :venue AND event_id = ?
            AND id NOT IN (SELECT table_id FROM table_master_table WHERE venue_id = :venue)
            ORDER BY table_name, master_table_name`, [eventId, eventId, eventId])
        return { rooms, tables } as RestaurantLayout
    }

    /** Saves the per-event layout edited by the staff during the service. */
    async saveLayout(ctx: VenueContext, layout: RestaurantLayout, eventId: number): Promise<number> {
        await ctx.db.find('events', eventId, 'id')
        const roomIds = layout.rooms.map(r => Number(r.id))
        const tables = layout.tables.filter(t => roomIds.includes(Number(t.room_id)))
        // Rooms, layout positions and tables named in the payload must be the venue's
        await ctx.db.ensure('rooms', tables.map(t => t.room_id))
        await ctx.db.ensure('master_tables_event', tables.filter(t => t.id !== undefined && t.id > 0).map(t => t.id))
        await ctx.db.ensure('tables', tables.map(t => t.table_id))
        await ctx.db.transaction(async tx => {
            await tx.execute(`UPDATE master_tables_event SET status = 'DELETED' WHERE venue_id = :venue AND event_id = ?`, [eventId])
            for (const t of tables) {
                const params = [t.default_seats, 'ACTIVE', t.room_id, t.x, t.y, t.width, t.height, t.shape, eventId]
                if (t.id !== undefined && t.id < 0) {
                    await tx.insert(`
                        INSERT INTO master_tables_event (venue_id, name, default_seats, status, room_id, x, y, width, height, shape, event_id)
                        VALUES (:venue,?,?,?,?,?,?,?,?,?,?)`, [t.name || t.master_table_name, ...params])
                } else {
                    await tx.execute(`
                        UPDATE master_tables_event SET name = ?, default_seats = ?, status = ?, room_id = ?, x = ?, y = ?, width = ?, height = ?, shape = ?
                        WHERE venue_id = :venue AND event_id = ? AND id = ?`, [t.master_table_name, ...params, t.id])
                    if (t.table_id && t.table_name !== t.master_table_name) {
                        await tx.execute('UPDATE tables SET name = ? WHERE venue_id = :venue AND id = ?', [t.master_table_name, t.table_id])
                    }
                }
            }
        })
        notify.tablesChanged()
        return 1
    }

    async getByEvent(ctx: VenueContext, eventId: number): Promise<Table[]> {
        await ctx.db.find('events', eventId, 'id')
        return ctx.db.query(`
            SELECT tables.id, tables.name, tables.paid, tables.status,
            ${tableItemsJson('tables.id')} items,
            ${userJson('tables.user_id')} user
            FROM tables
            WHERE venue_id = :venue AND event_id = ?
            ORDER BY paid, tables.id`, [eventId])
    }

    get(ctx: VenueContext, id: number): Promise<Table> {
        return ctx.db.find<Table>('tables', id)
    }

    async insertMultiple(ctx: VenueContext, eventId: number, tableNames: string[]): Promise<number> {
        await ctx.db.find('events', eventId, 'id')
        if (!tableNames.length) return 0
        const count = await ctx.db.transaction(async tx => {
            for (const name of tableNames) {
                await tx.insert('INSERT INTO tables (venue_id, event_id, name, user_id) VALUES (:venue,?,?,?)', [eventId, name, ctx.userId])
            }
            return tableNames.length
        })
        notify.tablesChanged(['waiter', 'table', 'checkout'])
        return count
    }

    /** Moves an open table to another position of the event layout, renaming it accordingly. */
    async changePosition(ctx: VenueContext, tableId: number, masterTableId: number): Promise<number> {
        await ctx.db.find('tables', tableId, 'id')
        const target = await ctx.db.find<MasterTable>('master_tables_event', masterTableId, 'name')
        const result = await ctx.db.transaction(async tx => {
            const link = await tx.queryOne('SELECT id FROM table_master_table WHERE venue_id = :venue AND table_id = ?', [tableId])
            if (link) {
                await tx.execute('UPDATE table_master_table SET master_table_id = ? WHERE venue_id = :venue AND table_id = ?', [masterTableId, tableId])
            } else {
                await tx.insert('INSERT INTO table_master_table (venue_id, master_table_id, table_id) VALUES (:venue, ?, ?)', [masterTableId, tableId])
            }
            return tx.execute('UPDATE tables SET name = ? WHERE venue_id = :venue AND id = ?', [target.name, tableId])
        })
        notify.tablesChanged()
        return result
    }

    /** Adds a discount as a negative, already paid item. */
    async insertDiscount(q: VenueDb, eventId: number, tableId: number, discount: number): Promise<number> {
        await q.find('events', eventId, 'id')
        await q.find('tables', tableId, 'id')
        // The discount goes to the venue's first destination: it is paid already, nobody has to prepare it
        return q.insert(`
            INSERT INTO items (venue_id, name, event_id, table_id, type, sub_type, price, done, paid, destination_id, icon)
            SELECT :venue, 'Sconto', ?, ?, 'Sconto', 'Sconto', ?, TRUE, TRUE, MIN(id), 'mdi-cart-percent'
            FROM destinations WHERE venue_id = :venue`,
            [eventId, tableId, -discount])
    }

    async paySelectedItems(q: VenueDb, tableId: number, itemIds: number[]): Promise<number> {
        await q.find('tables', tableId, 'id')
        if (!itemIds.length) return 0
        return q.execute(`UPDATE items SET paid = TRUE WHERE venue_id = :venue AND table_id = ? AND id IN (${placeholders(itemIds)})`,
            [tableId, ...itemIds])
    }

    /** Unpaid items of a table, with their price. */
    unpaidItems(q: VenueDb, tableId: number): Promise<{ id: number, price: number }[]> {
        return q.query('SELECT id, price FROM items WHERE venue_id = :venue AND table_id = ? AND IFNULL(paid, FALSE) = FALSE', [tableId])
    }

    /** Marks everything as paid and frees the layout position, inside the caller's transaction. */
    async closeWith(q: VenueDb, tableId: number): Promise<number> {
        await q.execute('UPDATE items SET paid = TRUE WHERE venue_id = :venue AND table_id = ?', [tableId])
        const affected = await q.executeOne(`UPDATE tables SET status = 'CLOSED', paid = TRUE WHERE venue_id = :venue AND id = ?`, [tableId])
        await q.execute('DELETE FROM table_master_table WHERE venue_id = :venue AND table_id = ?', [tableId])
        return affected
    }

    /** Marks everything as paid and frees the layout position. */
    async close(ctx: VenueContext, tableId: number): Promise<number> {
        const result = await ctx.db.transaction(tx => this.closeWith(tx, tableId))
        notify.tablesChanged(['waiter', 'table', 'checkout'])
        return result
    }
}

export default new TableService()
