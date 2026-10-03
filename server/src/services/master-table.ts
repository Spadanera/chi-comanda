import { placeholders } from '../db'
import { MasterTable, RestaurantLayout, Room } from '../../../models/src'
import { VenueContext } from '../venue/context'

/** The venue's default layout: rooms and tables, copied into each event when it starts. */
class MasterTableService {
    getAll(ctx: VenueContext): Promise<MasterTable[]> {
        return ctx.db.query(`SELECT * FROM master_tables WHERE venue_id = :venue AND status = 'ACTIVE'`)
    }

    /** A table of the current event layout. */
    getEventTable(ctx: VenueContext, id: number): Promise<MasterTable | undefined> {
        return ctx.db.queryOne('SELECT * FROM master_tables_event WHERE venue_id = :venue AND id = ?', [id])
    }

    async getLayout(ctx: VenueContext): Promise<RestaurantLayout> {
        const rooms = await ctx.db.query<Room>(`SELECT * FROM rooms WHERE venue_id = :venue AND status = 'ACTIVE'`)
        return { rooms, tables: await this.getAll(ctx) } as RestaurantLayout
    }

    /**
     * Replaces the whole layout. New rooms/tables come with negative temporary ids;
     * rooms and tables missing from the payload are soft-deleted.
     */
    async saveLayout(ctx: VenueContext, layout: RestaurantLayout): Promise<number> {
        // Existing rooms and tables in the payload must be the venue's
        const keptRoomIds = layout.rooms.filter(r => r.id > 0).map(r => r.id)
        await ctx.db.ensure('rooms', keptRoomIds)
        await ctx.db.ensure('master_tables', layout.tables.filter(t => t.id !== undefined && t.id > 0).map(t => t.id))
        return ctx.db.transaction(async tx => {
            if (keptRoomIds.length) {
                await tx.execute(`UPDATE rooms SET status = 'DELETED' WHERE venue_id = :venue AND id NOT IN (${placeholders(keptRoomIds)})`, keptRoomIds)
            } else {
                await tx.execute(`UPDATE rooms SET status = 'DELETED' WHERE venue_id = :venue`)
            }

            const roomIdMap = new Map<number, number>()
            for (const room of layout.rooms) {
                const params = [room.name, room.width, room.height, 'ACTIVE']
                if (room.id < 0) {
                    roomIdMap.set(Number(room.id),
                        await tx.insert('INSERT INTO rooms (venue_id, name, width, height, status) VALUES (:venue,?,?,?,?)', params))
                } else {
                    await tx.execute('UPDATE rooms SET name = ?, width = ?, height = ?, status = ? WHERE venue_id = :venue AND id = ?',
                        [...params, room.id])
                    roomIdMap.set(Number(room.id), room.id)
                }
            }

            await tx.execute(`UPDATE master_tables SET status = 'DELETED' WHERE venue_id = :venue`)
            for (const table of layout.tables) {
                const roomId = roomIdMap.get(Number(table.room_id))
                if (roomId === undefined) continue
                const params = [table.name, table.default_seats, table.status, roomId, table.x, table.y, table.width, table.height, table.shape]
                if (table.id !== undefined && table.id < 0) {
                    await tx.insert(`
                        INSERT INTO master_tables (venue_id, name, default_seats, status, room_id, x, y, width, height, shape)
                        VALUES (:venue,?,?,?,?,?,?,?,?,?)`, params)
                } else {
                    await tx.execute(`
                        UPDATE master_tables SET name = ?, default_seats = ?, status = ?, room_id = ?, x = ?, y = ?, width = ?, height = ?, shape = ?
                        WHERE venue_id = :venue AND id = ?`, [...params, table.id])
                }
            }
            return 1
        })
    }
}

export default new MasterTableService()
