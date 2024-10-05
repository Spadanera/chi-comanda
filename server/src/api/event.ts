import DB from "../db"
import { Event } from "../../../models/src"

export default class EventAPI {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<Event[]> {
        return await this.database.query('SELECT * FROM events', [])
    }

    async get(id: number): Promise<Event[]> {
        return await this.database.query('SELECT * FROM events WHERE ID = ?', [id])
    }

    async create(event: Event): Promise<number> {
        return await this.database.executeTransaction(async () => {
            const event_id = await this.database.execute('INSERT INTO events (name, date) VALUES (?,?)', [event.name, event.date])

            if (event.workers) {
                for (let i = 0; i < event.workers.length; i++) {
                    await this.database.execute("INSERT INTO workers (event_id, user_id) VALUES (?, ?)", [event_id, event.workers[i].id])
                }
            }

            return event_id
        })
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM events WHERE id = ?', [id])
    }

    async update(event: Event, id: number): Promise<number> {
        return await this.database.execute('UPDATE events SET name = ?, date = ? WHERE id = ?', [event.name, event.date, id])
    }
}