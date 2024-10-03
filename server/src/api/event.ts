import DB from "../db/index"
import { Event } from "../../../models/src"

export default class EventAPI {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<Event[]> {
        return await this.database.query('SELECT * FROM EVENTS', [])
    }

    async get(id: number): Promise<Event[]> {
        return await this.database.query('SELECT * FROM EVENTS WHERE ID = ?', [id])
    }

    async create(event: Event): Promise<number> {
        return await this.database.execute('INSERT INTO EVENTS (name, date) VALUES (?,?)', [event.name, event.date])
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM EVENTS WHERE id = ?', [id])
    }

    async update(event: Event, id: number): Promise<number> {
        return await this.database.execute('UPDATE EVENTS SET name = ?, date = ? WHERE id = ?', [event.name, event.date, id])
    }
}