import db from "../db"
import sendEmail from "../utils/mail"
import { User } from "../../../models/src"
import { type Invitation } from '../../../models/src/index';
import { getCurrentDateTimeInItaly } from "../utils/helper";
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, checkPassword } from "../utils/crypt";

class UserApi {
    constructor() {
    }

    async getAll(): Promise<User[]> {
        return await db.query(`SELECT id,username, email, status, (select json_arrayagg(name) FROM roles
            INNER JOIN user_role on roles.id = user_role.role_id WHERE user_id = users.id) as roles FROM users`, [])
    }

    async getByEmailAndPassword(email: string, password: string): Promise<User> {
        const result = await db.queryOne<User>(`SELECT id, email, username, password, (select json_arrayagg(name) FROM roles
            INNER JOIN user_role on roles.id = user_role.role_id WHERE user_id = users.id) as roles
            FROM users WHERE email = ? AND status = 'ACTIVE'`, [email])
        if (result.id && (await checkPassword(password, result.password || ''))) {
            delete result.password
            return result
        }
        else {
            throw new Error("Credenziali invalide")
        }
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
        return await db.executeUpdate('UPDATE users SET status = ? WHERE id = ?', [user.status, user.id])
    }

    async updateRoles(user: User): Promise<number> {
        return await db.executeTransaction([
            "DELETE FROM user_role WHERE user_id = ?",
            `INSERT INTO user_role (user_id, role_id) SELECT ?, id FROM roles WHERE name in (${user.roles?.map(value => `'${value}'`).join(',')})`
        ], [
            [user.id],
            [user.id]
        ])
    }

    async inviteUser(user: User): Promise<number> {
        console.log(user.roles?.join(','))
        if (user && user.email && !(await this.checkUserExists(user.email))) {
            const invitation = {
                email: user.email,
                creation_date: getCurrentDateTimeInItaly(),
                token: uuidv4()
            } as Invitation

            await sendEmail({
                to: user.email,
                subject: "Sei stato invitato a lavorare con Ludo Project su Chi Consegna!",
                html: `
                    Ciao, </br>
                    al seguente link puoi accettare il tuo invito impostando la password:</ br></ br>
                    <a href="${process.env.BASE_URL}/invitation/${invitation.token}">Accetta invito</a>
                `
            })

            const result = await db.executeInsert("INSERT INTO users (email, token, creation_date) VALUES (?,?,?)", [invitation.email, invitation.token, invitation.creation_date])
            return await db.executeInsert(`INSERT INTO user_role (user_id, role_id) SELECT ?, id FROM roles WHERE name in (${user.roles?.map(value => `'${value}'`).join(',')})`, [result])
        }
        return 0
    }

    async checkUserExists(email: string): Promise<boolean> {
        const users: User[] = await db.query("SELECT id FROM users WHERE email = ?", [email])
        if (users.length) {
            return true
        }
        return false
    }


    async acceptInvitation(invitation: Invitation): Promise<number> {
        if (invitation.password) {
            const _invitation: Invitation = await db.queryOne("SELECT * FROM users WHERE token = ?", [invitation.token])
            if (_invitation.id && _invitation.email && !(await this.checkUserExists(_invitation.email))) {
                return await db.executeUpdate("UPDATE users SET username = ?, password = ?, status =? WHERE id = ?",
                    [invitation.username, await hashPassword(invitation.password), 'ACTIVE', _invitation.id])
            }
            else {
                return 0
            }
        }
        throw new Error("Missing password")
    }

    async askResetPassword(invitation: Invitation): Promise<number> {
        if (invitation.email && (await this.checkUserExists(invitation.email || ''))) {
            const id = uuidv4()
            const result = await db.executeInsert("INSERT INTO reset (email, token, creation_date) VALUES (?,?,?)", [
                invitation.email, id, getCurrentDateTimeInItaly()
            ])
            await sendEmail({
                to: invitation.email,
                subject: "Chi Comanda - reimposta password!",
                html: `
                    Ciao, </br>
                    al seguente link effettuare il reset della tua password:</ br></ br>
                    <a href="${process.env.BASE_URL}/reset/${id}">Reimposta password</a>
                `
            })
            return result
        }
        else {
            return 0
        }
    }

    async resetPassword(invitation: Invitation): Promise<number> {
        var _reset: Invitation = await db.queryOne("SELECT id, email FROM reset WHERE token = ?", [invitation.token])
        var _user: User = await db.queryOne("SELECT id FROM users WHERE email = ?", [_reset.email])
        if (_reset.id && _user.id) {
            return await db.executeTransaction([
                "UPDATE users SET password = ? WHERE id = ?",
                "DELETE FROM reset WHERE id = ?",
            ], [
                [await hashPassword(invitation.password), _user.id],
                [_reset.id]
            ])
        }
        else {
            throw new Error("Reset non presente")
        }
    }

}

const userApi = new UserApi()
export default userApi