import db from "../db"
import { User } from "../../../models/src"

class ProfileApi {
    constructor() {
    }

    async get(id: number): Promise<User> {
        return await db.queryOne('SELECT username, avatar FROM users WHERE ID = ?', [id])
    }

    async updateAvatar(user: User): Promise<number> {
        return await db.executeUpdate('UPDATE users SET avatar = ? WHERE id = ?'
            , [user.avatar, user.id])
    }

    async updateUsername(user: User): Promise<number> {
        return await db.executeUpdate('UPDATE users SET username = ? WHERE id = ?'
            , [user.username, user.id])
    }
}

const profileApi = new ProfileApi()
export default profileApi