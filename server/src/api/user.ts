import db from "../db"
import sendEmail from "../utils/mail"
import { User } from "../../../models/src"
import { type Invitation } from '../../../models/src/index';
import { getCurrentDateTimeInItaly } from "../utils/helper";
import { v4 as uuidv4 } from 'uuid';

class UserApi {
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

    async inviteUser(user: User): Promise<number> {
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
                    <a href="https://chicomanda.it/invitation/${invitation.token}">Accetta invito</a>
                `
            })

            return await db.executeInsert("INSERT INTO invitations (email, token, creation_date) VALUES (?,?,?)", [invitation.email, invitation.token, invitation.creation_date])
        }
        return 0
    }

    async checkUserExists(email: string): Promise<boolean> {
        const users:User[] = await db.query("SELECT id FROM users WHERE email = ?", [email])
        if (users.length) {
            return true
        }
        return false
    }


    async acceptInvitation(invitation: Invitation): Promise<number> {
        const _invitation: Invitation = await db.queryOne("SELECT * FROM invitations WHERE token = ? AND email = ?", [invitation.token, invitation.email])
        if (_invitation.id && invitation.email && !(await this.checkUserExists(invitation.email))) {
            return await db.executeTransaction([
                "INSERT INTO users (username, email, password, creation_date, status) VALUES (?,?,?,?,?)",
                "DELETE FROM invitations WHERE id = ?"
            ], [
                [invitation.username, invitation.email, invitation.password, getCurrentDateTimeInItaly(), 'ACTIVE'],
                [_invitation.id]
            ])
        }
        else {
            return 0
        }
    }

    async askResetPassword(invitation: Invitation): Promise<number> {
        if (invitation.email && (await this.checkUserExists(invitation.email || ''))) {
            const id = uuidv4()
            await sendEmail({
                to: invitation.email,
                subject: "Chi Comanda - reset password!",
                html: `
                    Ciao, </br>
                    al seguente link effettuare il reset della tua password:</ br></ br>
                    <a href="https://chicomanda.it/reset/${invitation.token}">Accetta invito</a>
                `
            })
            return await db.executeInsert("INSERT INTO reset (email, token, creation_date) VALUES (?,?,?)", [
                invitation.email, id, getCurrentDateTimeInItaly()
            ])
        }
        else {
            return 0
        }
    }

    async resetPassword(invitation: Invitation): Promise<number> {
        var _reset = await db.queryOne("SELECT id FROM reset WHERE email = ? AND token = ?", [invitation.email, invitation.token])
        if (_reset.id) {
            return await db.executeTransaction([
                "UPDATE users SET password = ? WHERE email = ?",
                "DELETE FROM reset WHERE id = ?",
            ], [
                [invitation.password, invitation.email],
                [_reset.id]
            ])
        }
        else {
            return 0
        }
    }

}

const userApi = new UserApi()
export default userApi