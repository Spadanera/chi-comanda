import db from "../db"
import { MasterTable, RestaurantLayout, Room } from "../../../models/src"

class MasterTableApi {
    constructor() {
    }

    async getAll(): Promise<MasterTable[]> {
        return await db.query(`
            SELECT 
                master_tables.*,
                (
                    SELECT 
                        CASE WHEN COUNT(tables.id) > 0 THEN TRUE ELSE FALSE END 
                    FROM tables
                    INNER JOIN table_master_table ON table_master_table.table_id = tables.id
                    WHERE tables.status = 'ACTIVE' AND table_master_table.master_table_id = master_tables.id
                ) inUse
            FROM master_tables WHERE status = 'ACTIVE'`
        , [])
    }

    async get(id: number): Promise<MasterTable[]> {
        return await db.query('SELECT * FROM master_tables WHERE ID = ?', [id])
    }

    async create(table: MasterTable): Promise<number> {
        return await db.executeInsert('INSERT INTO master_tables (name, status) VALUES (?, ?)'
            , [table.name, table.status])
    }

    async delete(id: number): Promise<number> {
        return await db.executeUpdate('DELETE FROM master_tables WHERE id = ?', [id])
    }

    async update(table: MasterTable): Promise<number> {
        return await db.executeUpdate('UPDATE master_tables SET name = ?, default_seats = ?, status = ? WHERE id = ?'
            , [table.name, table.default_seats, table.status, table.id])
    }

    // layout section

    async getLayout(): Promise<RestaurantLayout> {
        const rooms = await db.query<Room>('SELECT * FROM rooms')
        return {
            rooms,
            tables: await this.getAll()
        } as RestaurantLayout
    }

    async saveLayout(layout:RestaurantLayout): Promise<number> {
        layout.rooms.forEach(async r => {
            const params = [r.name, r.width, r.height]
            if (r.id < 0) {
                const id = await db.executeInsert(`INSERT INTO rooms (name, width, height) VALUES (?,?,?)`, params)
                layout.tables.filter(t => t.room_id = r.id).forEach(t => { t.room_id = id })
            } else {
                await db.executeUpdate(`UPDATE rooms SET name = ?, width = ?, height = ? WHERE id = ?`, [...params, r.id])
            }
        })
        
        layout.tables.forEach(async t => {
            const params = [t.name, t.default_seats, t.status, t.room_id, t.x, t.y, t.width, t.height, t.shape]
            if (t.id !== undefined && t.id < 0) {
                const id = await db.executeInsert(`INSERT INTO master_tables 
                    (name, default_seats, status, room_id, x, y, width, height, shape) VALUES (?,?,?,?,?,?,?,?,?)`,
                    params)
            } else {
                await db.executeUpdate(`UPDATE master_tables SET name = ?, default_seats = ?, status = ?, room_id = ?, x = ?, y = ?, width = ?, height = ?, shape = ? 
                    WHERE id = ?`, 
                    [...params, t.id])
            }
        })

        return 1
    }
}

const masterItemApi = new MasterTableApi()
export default masterItemApi