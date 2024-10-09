import DB from "../db"
import { Event } from "../../../models/src"

export default class EventAPI {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<Event[]> {
        return await this.database.query('SELECT * FROM events ORDER BY date DESC', [])
    }

    async get(id: number): Promise<Event[]> {
        return await this.database.query('SELECT * FROM events WHERE ID = ?', [id])
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