import db, { placeholders, Queryable } from '../db'
import { MasterTable, RestaurantLayout, Room, Table } from '../../../models/src'
import { notify } from '../socket'
import { tableItemsJson, userJson } from '../db/sql'
import { NotFoundError } from '../http/errors'

/** Tables opened during an event, linked to the event layout through `table_master_table`. */
class TableService {
    /** Layout tables of the event not currently occupied by an active table. */
    getFree(eventId: number): Promise<MasterTable[]> {
        return db.query(`
            SELECT master_tables.id table_id, master_tables.name table_name
            FROM master_tables_event master_tables
            WHERE id NOT IN (
                SELECT master_table_id FROM table_master_table
                WHERE table_id IN (SELECT id FROM tables WHERE event_id = ? AND status = 'ACTIVE')
            ) AND master_tables.event_id = ? AND master_tables.status = 'ACTIVE'`, [eventId, eventId])
    }

    /**
     * Event layout with each table's items and owner. Closed tables and tables without a
     * layout position get the virtual room ids -1 and 0 respectively.
     */
    async getLayout(eventId: number): Promise<RestaurantLayout> {
        const rooms = await db.query<Room>(`SELECT * FROM rooms WHERE status = 'ACTIVE'`)
        const tables = await db.query<MasterTable>(`
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
                LEFT JOIN table_master_table ON tables.id = table_master_table.table_id
                WHERE tables.event_id = ? AND (tables.status = 'CLOSED' OR table_master_table.id IS NOT NULL)
            ) available_tables
            RIGHT JOIN master_tables_event master_tables ON available_tables.master_table_id = master_tables.id
            WHERE master_tables.status = 'ACTIVE' AND master_tables.event_id = ?
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
            WHERE event_id = ?
            AND id NOT IN (SELECT table_id FROM table_master_table)
            ORDER BY table_name, master_table_name`, [eventId, eventId, eventId])
        return { rooms, tables } as RestaurantLayout
    }

    /** Saves the per-event layout edited by the staff during the service. */
    async saveLayout(layout: RestaurantLayout, eventId: number): Promise<number> {
        const roomIds = layout.rooms.map(r => Number(r.id))
        await db.transaction(async tx => {
            await tx.execute(`UPDATE master_tables_event SET status = 'DELETED' WHERE event_id = ?`, [eventId])
            for (const t of layout.tables.filter(t => roomIds.includes(Number(t.room_id)))) {
                const params = [t.default_seats, 'ACTIVE', t.room_id, t.x, t.y, t.width, t.height, t.shape, eventId]
                if (t.id !== undefined && t.id < 0) {
                    await tx.insert(`
                        INSERT INTO master_tables_event (name, default_seats, status, room_id, x, y, width, height, shape, event_id)
                        VALUES (?,?,?,?,?,?,?,?,?,?)`, [t.name || t.master_table_name, ...params])
                } else {
                    await tx.execute(`
                        UPDATE master_tables_event SET name = ?, default_seats = ?, status = ?, room_id = ?, x = ?, y = ?, width = ?, height = ?, shape = ?
                        WHERE event_id = ? AND id = ?`, [t.master_table_name, ...params, t.id])
                    if (t.table_id && t.table_name !== t.master_table_name) {
                        await tx.execute('UPDATE tables SET name = ? WHERE id = ?', [t.master_table_name, t.table_id])
                    }
                }
            }
        })
        notify.tablesChanged()
        return 1
    }

    getByEvent(eventId: number): Promise<Table[]> {
        return db.query(`
            SELECT tables.id, tables.name, tables.paid, tables.status,
            ${tableItemsJson('tables.id')} items,
            ${userJson('tables.user_id')} user
            FROM tables
            WHERE event_id = ?
            ORDER BY paid, tables.id`, [eventId])
    }

    async get(id: number): Promise<Table> {
        const table = await db.queryOne<Table>('SELECT * FROM tables WHERE id = ?', [id])
        if (!table) {
            throw new NotFoundError('Tavolo non trovato')
        }
        return table
    }

    insertMultiple(eventId: number, tableNames: string[], userId: number): Promise<number> {
        if (!tableNames.length) return Promise.resolve(0)
        return db.transaction(async tx => {
            for (const name of tableNames) {
                await tx.insert('INSERT INTO tables (event_id, name, user_id) VALUES (?,?,?)', [eventId, name, userId])
            }
            return tableNames.length
        }).then(count => {
            notify.tablesChanged(['waiter', 'table', 'checkout'])
            return count
        })
    }

    /** Moves an open table to another position of the event layout, renaming it accordingly. */
    async changePosition(tableId: number, masterTableId: number): Promise<number> {
        const target = await db.queryOne<MasterTable>('SELECT name FROM master_tables_event WHERE id = ?', [masterTableId])
        if (!target) {
            throw new NotFoundError('Tavolo non trovato')
        }
        const result = await db.transaction(async tx => {
            const link = await tx.queryOne('SELECT id FROM table_master_table WHERE table_id = ?', [tableId])
            if (link) {
                await tx.execute('UPDATE table_master_table SET master_table_id = ? WHERE table_id = ?', [masterTableId, tableId])
            } else {
                await tx.insert('INSERT INTO table_master_table (master_table_id, table_id) VALUES (?, ?)', [masterTableId, tableId])
            }
            return tx.execute('UPDATE tables SET name = ? WHERE id = ?', [target.name, tableId])
        })
        notify.tablesChanged()
        return result
    }

    /** Adds a discount as a negative, already paid item. */
    insertDiscount(eventId: number, tableId: number, discount: number, q: Queryable = db): Promise<number> {
        return q.insert(`
            INSERT INTO items (name, event_id, table_id, type, sub_type, price, done, paid, destination_id, icon)
            VALUES ('Sconto', ?, ?, 'Sconto', 'Sconto', ?, TRUE, TRUE, 1, 'mdi-cart-percent')`,
            [eventId, tableId, -discount])
    }

    paySelectedItems(tableId: number, itemIds: number[], q: Queryable = db): Promise<number> {
        if (!itemIds.length) return Promise.resolve(0)
        return q.execute(`UPDATE items SET paid = TRUE WHERE table_id = ? AND id IN (${placeholders(itemIds)})`, [tableId, ...itemIds])
    }

    /** Unpaid items of a table, with their price. */
    unpaidItems(tableId: number, q: Queryable = db): Promise<{ id: number, price: number }[]> {
        return q.query('SELECT id, price FROM items WHERE table_id = ? AND IFNULL(paid, FALSE) = FALSE', [tableId])
    }

    /** Marks everything as paid and frees the layout position, inside the caller's transaction. */
    async closeWith(q: Queryable, tableId: number): Promise<number> {
        await q.execute('UPDATE items SET paid = TRUE WHERE table_id = ?', [tableId])
        const affected = await q.execute(`UPDATE tables SET status = 'CLOSED', paid = TRUE WHERE id = ?`, [tableId])
        await q.execute('DELETE FROM table_master_table WHERE table_id = ?', [tableId])
        return affected
    }

    /** Marks everything as paid and frees the layout position. */
    async close(tableId: number): Promise<number> {
        const result = await db.transaction(tx => this.closeWith(tx, tableId))
        notify.tablesChanged(['waiter', 'table', 'checkout'])
        return result
    }
}

export default new TableService()
