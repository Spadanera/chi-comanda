import DB from "../db/index"
import { User } from "../models/index"

export default class UserApi {
    database: DB

    constructor() {
        this.database = new DB()
    }

    async getAll(): Promise<User[]> {
        return await this.database.query('SELECT * FROM users', [])
    }

    async getByEmailAndPassword(email: string, password: string): Promise<User> {
        return await this.database.queryOne<User>('SELECT id, email, username FROM users WHERE email = ? AND password = ?', [email, password])
    }

    async getByEmail(email: string): Promise<User> {
        return await this.database.queryOne<User>('SELECT id, email, username FROM users WHERE email = ?', [email])
    }

    async get(id: number): Promise<User[]> {
        return await this.database.query('SELECT * FROM users WHERE ID = ?', [id])
    }

    async delete(id: number): Promise<number> {
        return await this.database.execute('DELETE FROM users WHERE id = ?', [id])
    }

    async update(user: User): Promise<number> {
        return await this.database.execute('UPDATE users SET email = ?, username = ?, password = ? WHERE id = ?', [user.email, user.username, user.password])
    }
}