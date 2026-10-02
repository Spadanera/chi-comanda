import db from '../db'

class ProfileService {
    updateAvatar(id: number, avatar: string): Promise<number> {
        return db.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatar, id])
    }

    updateUsername(id: number, username: string): Promise<number> {
        return db.execute('UPDATE users SET username = ? WHERE id = ?', [username, id])
    }
}

export default new ProfileService()
