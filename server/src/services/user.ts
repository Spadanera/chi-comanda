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

    /**
     * The user of a session, loaded on every request so role changes apply at once: the venues they can enter and
     * the roles held in the active one. The active venue is `venueId` when still allowed, otherwise the only venue
     * the user can enter, otherwise none (the user has to choose). `undefined` when the account is no longer active.
     * The superuser enters every active venue and keeps passing every role check there.
     */
    async getSessionUser(id: number, venueId?: number | null): Promise<User | undefined> {
        const user = await db.queryOne<User>(`SELECT id, email, username, avatar FROM users WHERE id = ? AND status = 'ACTIVE'`, [id])
        if (!user) return undefined
        const rows = await db.query<{ role: string, venue_id: number | null }>(`
            SELECT roles.name role, user_role.venue_id
            FROM user_role
            INNER JOIN roles ON roles.id = user_role.role_id
            WHERE user_role.user_id = ?`, [id])
        // A previous release may have written the superuser row with a venue: the role is global anyway
        const superuser = rows.some(r => r.role === Roles.superuser)
        const venueRoles = (venue: number) => rows
            .filter(r => r.venue_id === venue && r.role !== Roles.superuser).map(r => r.role)
        const venues = await db.query<{ id: number, name: string | null }>(`
            SELECT id, name FROM venues
            WHERE status = 'ACTIVE' AND (? OR id IN (SELECT venue_id FROM user_role WHERE user_id = ? AND venue_id IS NOT NULL))
            ORDER BY name, id`, [superuser, id])
        user.superuser = superuser
        user.venues = venues
            .map(v => ({ id: v.id, name: v.name || config.client.name || 'Chi Comanda', roles: venueRoles(v.id) }))
            .filter(v => superuser || v.roles.length > 0)
        const active = user.venues.find(v => v.id === venueId) ?? (user.venues.length === 1 ? user.venues[0] : undefined)
        user.venueId = active?.id ?? null
        user.roles = [...(superuser ? [Roles.superuser] : []), ...(active?.roles ?? [])]
        return user
    }

    private async requireSessionUser(id: number): Promise<User> {
        const user = await this.getSessionUser(id)
        if (!user) throw new UnauthorizedError()
        return user
    }

    async getByEmailAndPassword(email: string, password: string): Promise<User> {
        const user = await db.queryOne<User>(`SELECT id, password FROM users WHERE email = ? AND status = 'ACTIVE'`, [email])
        if (!user || !user.password || !(await checkPassword(password, user.password))) {
            throw new UnauthorizedError('Credenziali invalide')
        }
        await db.execute('UPDATE users SET last_login_date = ? WHERE id = ?', [nowInItaly(), user.id])
            .catch((error: Error) => console.error('Error setting last_login_date', error.message))
        return this.requireSessionUser(user.id!)
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

    /**
     * Non-deleted user with this e-mail, including pending invitations (status NULL).
     * Activated accounts win over pending invitations, should both exist.
     */
    private findByEmail(email: string): Promise<User | undefined> {
        return db.queryOne<User>(`
            SELECT id, status FROM users
            WHERE email = ? AND IFNULL(status, '') != 'DELETED'
            ORDER BY status IS NULL, id
            LIMIT 1`, [email])
    }

    /** Invites a new e-mail, or re-sends a pending invitation with a fresh token and the given roles. */
    async inviteUser(user: User): Promise<void> {
        if (!user?.email) {
            throw new BadRequestError('Email mancante')
        }
        const existing = await this.findByEmail(user.email)
        if (existing && existing.status != null) {
            throw new BadRequestError('Utente già esistente')
        }
        const token = uuidv4()
        await db.transaction(async tx => {
            let userId = existing?.id
            if (userId) {
                await tx.execute('UPDATE users SET token = ?, creation_date = ? WHERE id = ?', [token, nowInItaly(), userId])
            } else {
                userId = await tx.insert('INSERT INTO users (email, token, creation_date) VALUES (?,?,?)', [user.email, token, nowInItaly()])
            }
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
        return this.requireSessionUser(invited.id!)
    }

    async findOrCreateGoogleUser(googleId: string, email: string, displayName: string, avatar: string): Promise<User> {
        const linked = await db.queryOne<User>('SELECT id FROM users WHERE googleId = ?', [googleId])
        if (linked) {
            return this.requireSessionUser(linked.id!)
        }

        // Existing account or pending invitation with the same e-mail: link it to Google and refresh the avatar
        const existing = await this.findByEmail(email)
        if (existing) {
            await db.execute(`
                UPDATE users SET googleId = ?, username = COALESCE(username, ?), avatar = ?, status = 'ACTIVE', token = NULL, last_login_date = ?
                WHERE id = ?`, [googleId, displayName, avatar, nowInItaly(), existing.id])
            return this.requireSessionUser(existing.id!)
        }

        // New Google-only account, without roles until a superuser assigns them
        const newId = await db.insert(`
            INSERT INTO users (email, username, googleId, avatar, status, creation_date) VALUES (?,?,?,?,'ACTIVE',?)`,
            [email, displayName, googleId, avatar, nowInItaly()])
        return this.requireSessionUser(newId)
    }

    /** Always succeeds, so the endpoint can't be used to discover registered e-mails. */
    async askResetPassword(email: string | undefined): Promise<void> {
        // Pending invitations get no reset link: they have to accept the invitation first
        const user = email && await this.findByEmail(email)
        if (!user || user.status == null) {
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
