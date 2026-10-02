import db, { placeholders } from '../db'
import { MasterTable, RestaurantLayout, Room } from '../../../models/src'

/** The restaurant's default layout: rooms and tables, copied into each event when it starts. */
class MasterTableService {
    getAll(): Promise<MasterTable[]> {
        return db.query(`SELECT * FROM master_tables WHERE status = 'ACTIVE'`)
    }

    /** A table of the current event layout. */
    getEventTable(id: number): Promise<MasterTable | undefined> {
        return db.queryOne('SELECT * FROM master_tables_event WHERE id = ?', [id])
    }

    create(table: MasterTable): Promise<number> {
        return db.insert('INSERT INTO master_tables (name, status) VALUES (?, ?)', [table.name, table.status])
    }

    update(table: MasterTable): Promise<number> {
        return db.execute('UPDATE master_tables SET name = ?, default_seats = ?, status = ? WHERE id = ?',
            [table.name, table.default_seats, table.status, table.id])
    }

    async getLayout(): Promise<RestaurantLayout> {
        const rooms = await db.query<Room>(`SELECT * FROM rooms WHERE status = 'ACTIVE'`)
        return { rooms, tables: await this.getAll() } as RestaurantLayout
    }

    /**
     * Replaces the whole layout. New rooms/tables come with negative temporary ids;
     * rooms and tables missing from the payload are soft-deleted.
     */
    saveLayout(layout: RestaurantLayout): Promise<number> {
        return db.transaction(async tx => {
            const keptRoomIds = layout.rooms.filter(r => r.id > 0).map(r => r.id)
            if (keptRoomIds.length) {
                await tx.execute(`UPDATE rooms SET status = 'DELETED' WHERE id NOT IN (${placeholders(keptRoomIds)})`, keptRoomIds)
            } else {
                await tx.execute(`UPDATE rooms SET status = 'DELETED'`)
            }

            const roomIdMap = new Map<number, number>()
            for (const room of layout.rooms) {
                const params = [room.name, room.width, room.height, 'ACTIVE']
                if (room.id < 0) {
                    roomIdMap.set(Number(room.id), await tx.insert('INSERT INTO rooms (name, width, height, status) VALUES (?,?,?,?)', params))
                } else {
                    await tx.execute('UPDATE rooms SET name = ?, width = ?, height = ?, status = ? WHERE id = ?', [...params, room.id])
                    roomIdMap.set(Number(room.id), room.id)
                }
            }

            await tx.execute(`UPDATE master_tables SET status = 'DELETED'`)
            for (const table of layout.tables) {
                const roomId = roomIdMap.get(Number(table.room_id))
                if (roomId === undefined) continue
                const params = [table.name, table.default_seats, table.status, roomId, table.x, table.y, table.width, table.height, table.shape]
                if (table.id !== undefined && table.id < 0) {
                    await tx.insert(`
                        INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape)
                        VALUES (?,?,?,?,?,?,?,?,?)`, params)
                } else {
                    await tx.execute(`
                        UPDATE master_tables SET name = ?, default_seats = ?, status = ?, room_id = ?, x = ?, y = ?, width = ?, height = ?, shape = ?
                        WHERE id = ?`, [...params, table.id])
                }
            }
            return 1
        })
    }
}

export default new MasterTableService()
