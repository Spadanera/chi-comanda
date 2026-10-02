import { v4 as uuidv4 } from 'uuid'
import db, { placeholders, Queryable } from '../db'
import config from '../config'
import sendEmail, { actionEmail } from '../utils/mail'
import { Invitation, User } from '../../../models/src'
import { nowInItaly } from '../utils/date'
import { hashPassword, checkPassword } from '../utils/crypt'
import { Roles } from '../http/middleware'
import { BadRequestError, UnauthorizedError } from '../http/errors'
import { USER_ROLES_JSON } from '../db/sql'

const SESSION_USER_COLUMNS = `id, email, username, avatar, ${USER_ROLES_JSON} AS roles`

/** SQL condition: `column` is a datetime within the invitation/reset token lifetime. */
const TOKEN_NOT_EXPIRED = (column: string) => `${column} >= NOW() - INTERVAL ${config.tokenTtlHours} HOUR`

async function assignRoles(tx: Queryable, userId: number, roles: string[]) {
    await tx.execute('DELETE FROM user_role WHERE user_id = ?', [userId])
    if (roles.length) {
        await tx.execute(`INSERT INTO user_role (user_id, role_id) SELECT ?, id FROM roles WHERE name IN (${placeholders(roles)})`,
            [userId, ...roles])
    }
}

class UserService {
    getAll(): Promise<User[]> {
        return db.query(`
            SELECT id, username, email, status, avatar, ${USER_ROLES_JSON} AS roles
            FROM users
            WHERE IFNULL(status, '') != 'DELETED'`)
    }

    /** Active users holding at least one role: the people that can be staffed on an event. */
    getAvailable(): Promise<User[]> {
        const roles = Object.values(Roles)
        return db.query(`
            SELECT id, username, avatar, ${USER_ROLES_JSON} AS roles
            FROM users
            WHERE status = 'ACTIVE'
            AND EXISTS (
                SELECT user_id
                FROM user_role
                INNER JOIN roles ON roles.id = user_role.role_id
                WHERE user_role.user_id = users.id
                AND roles.name IN (${placeholders(roles)})
            )`, roles)
    }

    private async getSessionUser(id: number): Promise<User> {
        const user = await db.queryOne<User>(`SELECT ${SESSION_USER_COLUMNS} FROM users WHERE id = ?`, [id])
        if (!user) throw new UnauthorizedError()
        user.roles = user.roles || []
        return user
    }

    async getByEmailAndPassword(email: string, password: string): Promise<User> {
        const user = await db.queryOne<User>(
            `SELECT ${SESSION_USER_COLUMNS}, password FROM users WHERE email = ? AND status = 'ACTIVE'`, [email])
        if (!user || !user.password || !(await checkPassword(password, user.password))) {
            throw new UnauthorizedError('Credenziali invalide')
        }
        delete user.password
        user.roles = user.roles || []
        await db.execute('UPDATE users SET last_login_date = ? WHERE id = ?', [nowInItaly(), user.id])
            .catch((error: Error) => console.error('Error setting last_login_date', error.message))
        return user
    }

    async getAvatar(id: number): Promise<string | undefined> {
        return (await db.queryOne<User>('SELECT avatar FROM users WHERE id = ?', [id]))?.avatar
    }

    delete(id: number): Promise<void> {
        return db.transaction(async tx => {
            await tx.execute('DELETE FROM user_role WHERE user_id = ?', [id])
            await tx.execute(`UPDATE users SET status = 'DELETED' WHERE id = ?`, [id])
        })
    }

    updateStatus(user: User): Promise<number> {
        return db.execute('UPDATE users SET status = ? WHERE id = ?', [user.status, user.id])
    }

    updateRoles(user: User): Promise<void> {
        return db.transaction(tx => assignRoles(tx, user.id!, user.roles || []))
    }

    private async emailExists(email: string): Promise<boolean> {
        // Pending invitations (status NULL) don't count, so an expired invitation can be sent again
        return !!(await db.queryOne(`SELECT id FROM users WHERE email = ? AND status != 'DELETED'`, [email]))
    }

    async inviteUser(user: User): Promise<void> {
        if (!user?.email) {
            throw new BadRequestError('Email mancante')
        }
        if (await this.emailExists(user.email)) {
            throw new BadRequestError('Utente già esistente')
        }
        const token = uuidv4()
        await db.transaction(async tx => {
            const userId = await tx.insert('INSERT INTO users (email, token, creation_date) VALUES (?,?,?)', [user.email, token, nowInItaly()])
            await assignRoles(tx, userId, user.roles || [])
        })
        await sendEmail({
            to: user.email,
            subject: 'Unisciti a Chi Comanda',
            html: actionEmail({
                title: 'Sei stato invitato ad unirti a Chi Comanda!',
                intro: 'Sei stato invitato ad unirti a Chi Comanda.',
                action: "Per accettare l'invito e impostare la tua password, clicca sul pulsante qui sotto:",
                buttonLabel: 'Accetta invito',
                url: `${config.baseUrl}/invitation/${token}`,
            }),
        })
    }

    /** Pending invitation for `token`, if it exists and has not expired. */
    private async findInvitation(token: string | undefined): Promise<User> {
        const invited = token && await db.queryOne<User>(
            `SELECT id, email FROM users WHERE token = ? AND ${TOKEN_NOT_EXPIRED('creation_date')}`, [token])
        if (!invited) {
            throw new BadRequestError('Invito non valido o scaduto')
        }
        return invited
    }

    async acceptInvitation(invitation: Invitation): Promise<number> {
        if (!invitation.password) {
            throw new BadRequestError('Password mancante')
        }
        const invited = await this.findInvitation(invitation.token)
        return db.execute(`UPDATE users SET username = ?, password = ?, status = 'ACTIVE', avatar = ?, token = NULL WHERE id = ?`,
            [invitation.username, await hashPassword(invitation.password), invitation.avatar, invited.id])
    }

    async acceptInvitationWithGoogle(token: string, googleId: string, displayName: string, avatar: string): Promise<User> {
        const invited = await this.findInvitation(token)
        await db.execute(`
            UPDATE users SET googleId = ?, username = ?, avatar = ?, status = 'ACTIVE', token = NULL, last_login_date = ?
            WHERE id = ?`, [googleId, displayName, avatar, nowInItaly(), invited.id])
        return this.getSessionUser(invited.id!)
    }

    async findOrCreateGoogleUser(googleId: string, email: string, displayName: string, avatar: string): Promise<User> {
        const linked = await db.queryOne<User>('SELECT id FROM users WHERE googleId = ?', [googleId])
        if (linked) {
            return this.getSessionUser(linked.id!)
        }

        // Existing account with the same e-mail: link it to Google and refresh the avatar
        const existing = await db.queryOne<User>(`SELECT id FROM users WHERE email = ? AND status != 'DELETED'`, [email])
        if (existing) {
            await db.execute(`
                UPDATE users SET googleId = ?, username = COALESCE(username, ?), avatar = ?, status = 'ACTIVE', last_login_date = ?
                WHERE id = ?`, [googleId, displayName, avatar, nowInItaly(), existing.id])
            return this.getSessionUser(existing.id!)
        }

        // New Google-only account, without roles until a superuser assigns them
        const newId = await db.insert(`
            INSERT INTO users (email, username, googleId, avatar, status, creation_date) VALUES (?,?,?,?,'ACTIVE',?)`,
            [email, displayName, googleId, avatar, nowInItaly()])
        return this.getSessionUser(newId)
    }

    /** Always succeeds, so the endpoint can't be used to discover registered e-mails. */
    async askResetPassword(email: string | undefined): Promise<void> {
        if (!email || !(await this.emailExists(email))) {
            return
        }
        const token = uuidv4()
        await db.insert('INSERT INTO reset (email, token, creation_date) VALUES (?,?,NOW())', [email, token])
        await sendEmail({
            to: email,
            subject: 'Reimposta la password su Chi Comanda',
            html: actionEmail({
                title: 'Reimposta password su Chi Comanda.',
                intro: 'Hai fatto richiesta per reimpostare la password su Chi Comanda.',
                action: 'Per reimpostare la password segui il seguente link:',
                buttonLabel: 'Reimposta Password',
                url: `${config.baseUrl}/reset/${token}`,
            }),
        })
    }

    async resetPassword(invitation: Invitation): Promise<number> {
        if (!invitation.password) {
            throw new BadRequestError('Password mancante')
        }
        const reset = invitation.token && await db.queryOne<{ id: number, email: string }>(
            `SELECT id, email FROM reset WHERE token = ? AND ${TOKEN_NOT_EXPIRED('creation_date')}`, [invitation.token])
        const user = reset && await db.queryOne<User>(`SELECT id FROM users WHERE email = ? AND IFNULL(status, '') != 'DELETED'`, [reset.email])
        if (!reset || !user) {
            throw new BadRequestError('Link di reset non valido o scaduto')
        }
        const hash = await hashPassword(invitation.password)
        return db.transaction(async tx => {
            const affected = await tx.execute('UPDATE users SET password = ? WHERE id = ?', [hash, user.id])
            await tx.execute('DELETE FROM reset WHERE email = ?', [reset.email])
            return affected
        })
    }
}

export default new UserService()
