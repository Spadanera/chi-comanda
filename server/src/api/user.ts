import db from "../db"
import { User } from "../../../models/src"

export default class UserApi {
    constructor() {
    }

    async getAll(): Promise<User[]> {
        return await db.query('SELECT * FROM users', [])
    }

    async getByEmailAndPassword(email: string, password: string): Promise<User> {
        return await db.queryOne<User>(`SELECT id, email, username, (select json_arrayagg(name) FROM roles
            INNER JOIN user_role on roles.id = user_role.role_id WHERE user_id = users.id) as roles
            FROM users WHERE email = ? AND password = ?`, [email, password])
    }

    async getByEmail(email: string): Promise<User> {
        return await db.queryOne<User>('SELECT id, email, username FROM users WHERE email = ?', [email])
    }

    async get(id: number): Promise<User[]> {
        return await db.query('SELECT * FROM users WHERE ID = ?', [id])
    }

    async delete(id: number): Promise<number> {
        return await db.executeUpdate('DELETE FROM users WHERE id = ?', [id])
    }

    async update(user: User): Promise<number> {
        return await db.executeUpdate('UPDATE users SET email = ?, username = ?, password = ? WHERE id = ?', [user.email, user.username, user.password])
    }
}