import db from "../db"
import { Event } from "../../../models/src"

class EventAPI {
    constructor() {
    }

    async getAll(): Promise<Event[]> {
        return await db.query(`
            SELECT events.id, events.name name, events.date, events.status, menu.name manu_name,
            (SELECT count(tables.id) FROM tables WHERE event_id = events.id) tableCount,
            (SELECT sum(items.price) FROM items WHERE items.event_id = events.id AND type != 'Sconto') revenue,
            (SELECT sum(items.price) FROM items WHERE items.event_id = events.id AND type = 'Sconto') discount,
            (SELECT sum(items.price) FROM items WHERE items.event_id = events.id AND type != 'Sconto' AND items.paid = 1) currentPaid,
            (SELECT count(tables.id) FROM tables WHERE tables.event_id = events.id AND tables.status = 'ACTIVE') tablesOpen
            FROM events
            INNER JOIN menu ON events.menu_id = menu.id
            ORDER BY date DESC`
            , [])
    }

    async get(id: number): Promise<Event[]> {
        return await db.query(`
            SELECT 
                events.id,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', grouped_tables.id,
                        'name', grouped_tables.table_name,
                        'revenue', grouped_tables.revenue,
                        'items', grouped_tables.items))
                        FROM 
                        (SELECT 
                            tables.id, tables.name table_name,
                            (SELECT SUM(price) FROM items WHERE items.table_id = tables.id) revenue, (
                                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                                    'name', grouped_items.name, 
                                    'type', grouped_items.type, 
                                    'sub_type', grouped_items.sub_type, 
                                    'price', grouped_items.price,
                                    'quantity', grouped_items.quantity
                                )) 
                                FROM (
                                    SELECT items.name, IFNULL(types.name, items.type) type, IFNULL(sub_types.name, items.sub_type) sub_type, items.price, COUNT(items.id) quantity
                                    FROM items
                                    LEFT JOIN sub_types ON sub_types.id = items.sub_type_id
                                    LEFT JOIN types ON sub_types.type_id = types.id
                                    WHERE items.table_id = tables.id
                                    GROUP BY items.name, IFNULL(types.name, items.type), IFNULL(sub_types.name, items.sub_type), items.price
                                    ORDER BY IFNULL(types.name, items.type), IFNULL(sub_types.name, items.sub_type), items.name
                                ) grouped_items
                            ) items
                        FROM tables 
                        WHERE tables.event_id = events.id
                        AND EXISTS (SELECT id FROM items WHERE items.table_id = tables.id)
                    ) grouped_tables
                ) tables
            FROM events WHERE events.id = ?`
            , [id])
    }

    async getOnGoing(): Promise<Event> {
        try {
            return await db.queryOne<Event>('SELECT * FROM events WHERE STATUS = ?', ["ONGOING"])
        } catch (error) {
            return {} as Event
        }
    }

    async create(event: Event): Promise<number> {
        return db.executeInsert('INSERT INTO events (name, date, status, menu_id) VALUES (?,?,?,?)', [event.name, (event.date + "").split('T')[0], 'PLANNED', event.menu_id])
    }

    async delete(id: number): Promise<number> {
        const tables = await db.query('SELECT id FROM tables WHERE event_id = ?', [id])
        if (tables.length) {
            throw new Error("Can't delete the event. Tables connected")
        }
        return await db.executeUpdate('DELETE FROM events WHERE id = ?', [id])
    }

    async update(event: Event, id: number): Promise<number> {
        return await db.executeUpdate('UPDATE events SET status = ? WHERE id = ?', [event.status, id])
    }
}

const eventApi = new EventAPI()

export default eventApi
