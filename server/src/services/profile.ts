import db from '../db'
import { User } from '../../../models/src'

class ProfileService {
    async get(id: number): Promise<User> {
        return (await db.queryOne<User>('SELECT username, avatar FROM users WHERE id = ?', [id])) || ({} as User)
    }

    updateAvatar(id: number, avatar: string): Promise<number> {
        return db.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatar, id])
    }

    updateUsername(id: number, username: string): Promise<number> {
        return db.execute('UPDATE users SET username = ? WHERE id = ?', [username, id])
    }
}

export default new ProfileService()
