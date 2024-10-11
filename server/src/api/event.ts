import DB from "../db"
import { Event } from "../../../models/src"

export default class EventAPI {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<Event[]> {
        return await this.database.query(`
            SELECT id, name, date, status,
            (SELECT count(tables.id) FROM tables WHERE event_id = events.id) tableCount,
            (SELECT count(items.id) FROM items INNER JOIN master_items ON items.master_item_id = master_items.id WHERE event_id = events.id AND master_items.type = 'Bevanda') beverageCount,
            (SELECT count(items.id) FROM items INNER JOIN master_items ON items.master_item_id = master_items.id WHERE event_id = events.id AND master_items.type IN ('Cibo')) foodCount,
            (SELECT sum(items.price) FROM items WHERE event_id = events.id) revenue
            FROM events
            ORDER BY date DESC`
            , [])
    }

    async get(id: number): Promise<Event[]> {
        return await this.database.query(`
            SELECT events.id, (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'name', grouped_items.name, 
                    'type', grouped_items.type, 
                    'sub_type', grouped_items.sub_type, 
                    'price', grouped_items.price,
                    'quantity', grouped_items.quantity
                )) 
                FROM (
                    SELECT items.name, master_items.type, master_items.sub_type, items.price, COUNT(items.id) quantity
                    FROM items 
                    INNER JOIN master_items ON master_items.id = items.master_item_id
                    WHERE items.event_id = events.id
                    GROUP BY items.name, master_items.type, master_items.sub_type, items.price
                    ORDER BY master_items.sub_type, master_items.type, items.name
                ) grouped_items
                ) items
            FROM events WHERE events.id = ?`
            , [id])
    }

    async getOnGoing(): Promise<Event> {
        try {
            return await this.database.queryOne<Event>('SELECT * FROM events WHERE STATUS = ?', ["ONGOING"])
        } catch (error) {
            return {} as Event
        }
    }

    async create(event: Event): Promise<number> {
        return this.database.execute('INSERT INTO events (name, date, status) VALUES (?,?,?)', [event.name, (event.date + "").split('T')[0], 'PLANNED'])
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM events WHERE id = ?', [id])
    }

    async update(event: Event, id: number): Promise<number> {
        return await this.database.execute('UPDATE events SET status = ? WHERE id = ?', [event.status, id])
    }
}