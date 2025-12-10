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
        const rooms = await db.query<Room>(`SELECT * FROM rooms WHERE status = 'ACTIVE'`)
        return {
            rooms,
            tables: await this.getAll()
        } as RestaurantLayout
    }

    async saveLayout(layout: RestaurantLayout): Promise<number> {
        await db.executeUpdate(`UPDATE rooms SET status = 'DELETED' WHERE id NOT IN (${layout.rooms.filter(t => t.id > 0).map(t => t.id).join(',')})`, [])
        for (const r of layout.rooms) {
            const params = [r.name, r.width, r.height, 'ACTIVE'];
            if (r.id < 0) {
                const id = await db.executeInsert(`INSERT INTO rooms (name, width, height, status) VALUES (?,?,?,?)`, params);

                layout.tables = layout.tables.map(t =>
                    t.room_id === r.id
                        ? { ...t, room_id: id }
                        : t
                );
                r.id = id
            } else {
                await db.executeUpdate(`UPDATE rooms SET name = ?, width = ?, height = ?, status = ? WHERE id = ?`, [...params, r.id]);
            }
        }
        let transactionQueries: [string] = ['UPDATE master_tables SET status = ?']
        let transactionParams: [any[]] = [['DELETED']]
        layout.tables.filter(t => layout.rooms.map(r => r.id).includes(t.room_id)).forEach(async t => {
            const params = [t.name, t.default_seats, t.status, t.room_id, t.x, t.y, t.width, t.height, t.shape]
            if (t.id !== undefined && t.id < 0) {
                transactionQueries.push(`INSERT INTO master_tables 
                    (name, default_seats, status, room_id, x, y, width, height, shape) VALUES (?,?,?,?,?,?,?,?,?)`)
                transactionParams.push(params)
            } else {
                transactionQueries.push(`UPDATE master_tables SET name = ?, default_seats = ?, status = ?, room_id = ?, x = ?, y = ?, width = ?, height = ?, shape = ? 
                    WHERE id = ?`)
                transactionParams.push([...params, t.id])
            }
        })

        await db.executeTransaction(transactionQueries, transactionParams)

        return 1
    }
}

const masterItemApi = new MasterTableApi()
export default masterItemApi