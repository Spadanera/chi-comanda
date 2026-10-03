import { v4 as uuidv4 } from 'uuid'
import db from '../db'
import config from '../config'
import sendEmail, { actionEmail } from '../utils/mail'
import { Invitation, User, UserVenue } from '../../../models/src'
import { nowInItaly } from '../utils/date'
import { hashPassword, checkPassword } from '../utils/crypt'
import { Roles } from '../http/middleware'
import { BadRequestError, UnauthorizedError } from '../http/errors'
import { venueFeatures } from '../features'

/** SQL condition: `column` is a datetime within the invitation/reset token lifetime. */
const TOKEN_NOT_EXPIRED = (column: string) => `${column} >= NOW() - INTERVAL ${config.tokenTtlHours} HOUR`

/** A user of the platform with the venues they work in, for the superuser. */
export interface PlatformUser extends User {
    venues: UserVenue[]
}

/** Outcome of an invitation: a new or refreshed token, or an account that is already active. */
export type InvitationTarget = { userId: number, token: string } | { userId: number, active: true, username?: string }

class UserService {
    /** Every user that is not deleted, with the venues they work in (platform screen). */
    async getAll(): Promise<PlatformUser[]> {
        const users = await db.query<PlatformUser>(`
            SELECT id, username, email, status, avatar,
                EXISTS (SELECT 1 FROM user_role INNER JOIN roles ON roles.id = user_role.role_id
                        WHERE user_role.user_id = users.id AND roles.name = 'superuser') superuser
            FROM users
            WHERE IFNULL(status, '') != 'DELETED'
            ORDER BY username, email`)
        const roles = await db.query<{ user_id: number, venue_id: number, name: string | null, role: string }>(`
            SELECT user_role.user_id, user_role.venue_id, venues.name, roles.name role
            FROM user_role
            INNER JOIN roles ON roles.id = user_role.role_id
            INNER JOIN venues ON venues.id = user_role.venue_id
            WHERE roles.name != 'superuser'
            ORDER BY venues.name, venues.id`)
        for (const user of users) {
            user.superuser = !!user.superuser
            user.venues = []
            for (const r of roles.filter(r => r.user_id === user.id)) {
                const venue = user.venues.find(v => v.id === r.venue_id)
                if (venue) venue.roles.push(r.role)
                else user.venues.push({ id: r.venue_id, name: r.name || config.client.name || 'Chi Comanda', roles: [r.role] })
            }
        }
        return users
    }

    /**
     * Active accounts that could join venue `venueId`, to pick instead of typing an e-mail: every account for the
     * superuser; for a venue admin, the people of the other venues they are admin of (never the staff of a venue
     * that isn't theirs).
     */
    candidatesFor(venueId: number, callerId: number, superuser: boolean): Promise<User[]> {
        return db.query<User>(`
            SELECT id, username, email, avatar FROM users
            WHERE status = 'ACTIVE'
            AND NOT EXISTS (SELECT 1 FROM user_role WHERE user_role.user_id = users.id AND user_role.venue_id = ?)
            AND (? OR EXISTS (
                SELECT 1 FROM user_role theirs
                WHERE theirs.user_id = users.id AND theirs.venue_id IN (
                    SELECT mine.venue_id FROM user_role mine INNER JOIN roles ON roles.id = mine.role_id
                    WHERE mine.user_id = ? AND roles.name = 'admin' AND mine.venue_id IS NOT NULL
                )
            ))
            ORDER BY username, email`, [venueId, superuser, callerId])
    }

    /** Grants or revokes the platform's superuser role. */
    async setSuperuser(userId: number, superuser: boolean): Promise<void> {
        await db.transaction(async tx => {
            await tx.execute(`DELETE FROM user_role WHERE user_id = ? AND role_id = (SELECT id FROM roles WHERE name = 'superuser')`, [userId])
            if (superuser) {
                await tx.execute(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, NULL FROM roles WHERE name = 'superuser'`, [userId])
            }
        })
    }

    /** Whether the user still holds any role, in any venue or on the platform. */
    async hasAnyRole(userId: number): Promise<boolean> {
        return !!(await db.queryOne('SELECT 1 FROM user_role WHERE user_id = ? LIMIT 1', [userId]))
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
        const venues = await db.query<{ id: number, name: string | null, features: unknown }>(`
            SELECT id, name, features FROM venues
            WHERE status = 'ACTIVE' AND (? OR id IN (SELECT venue_id FROM user_role WHERE user_id = ? AND venue_id IS NOT NULL))
            ORDER BY name, id`, [superuser, id])
        user.superuser = superuser
        user.venues = venues
            .map(v => ({ id: v.id, name: v.name || config.client.name || 'Chi Comanda', roles: venueRoles(v.id) }))
            .filter(v => superuser || v.roles.length > 0)
        const active = user.venues.find(v => v.id === venueId) ?? (user.venues.length === 1 ? user.venues[0] : undefined)
        user.venueId = active?.id ?? null
        user.roles = [...(superuser ? [Roles.superuser] : []), ...(active?.roles ?? [])]
        user.features = active ? [...venueFeatures(config.features, venues.find(v => v.id === active.id)!.features)] : []
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

    /** Deletes the account: no role left anywhere, no login. */
    delete(id: number): Promise<void> {
        return db.transaction(async tx => {
            await tx.execute('DELETE FROM user_role WHERE user_id = ?', [id])
            await tx.execute(`UPDATE users SET status = 'DELETED' WHERE id = ?`, [id])
        })
    }

    async updateStatus(user: User): Promise<number> {
        if (!['ACTIVE', 'BLOCKED'].includes(String(user.status))) {
            throw new BadRequestError('Stato non valido')
        }
        return db.execute(`UPDATE users SET status = ? WHERE id = ? AND IFNULL(status, '') != 'DELETED'`, [user.status, user.id])
    }

    /**
     * Non-deleted user with this e-mail, including pending invitations (status NULL).
     * Activated accounts win over pending invitations, should both exist.
     */
    findByEmail(email: string): Promise<User | undefined> {
        return db.queryOne<User>(`
            SELECT id, status, username FROM users
            WHERE email = ? AND IFNULL(status, '') != 'DELETED'
            ORDER BY status IS NULL, id
            LIMIT 1`, [email])
    }

    /**
     * Prepares the invitation of an e-mail: a new pending account, or a fresh token for a pending one. An active
     * account needs no invitation: the caller only gives it roles.
     */
    async issueInvitation(email: string): Promise<InvitationTarget> {
        const existing = await this.findByEmail(email)
        if (existing && existing.status != null) {
            return { userId: existing.id!, active: true, username: existing.username }
        }
        const token = uuidv4()
        if (existing) {
            await db.execute('UPDATE users SET token = ?, creation_date = ? WHERE id = ?', [token, nowInItaly(), existing.id])
            return { userId: existing.id!, token }
        }
        const userId = await db.insert('INSERT INTO users (email, token, creation_date) VALUES (?,?,?)', [email, token, nowInItaly()])
        return { userId, token }
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
        await sendEmail(actionEmail({
            to: email,
            subject: 'Reimposta la password di Chi Comanda',
            title: 'Reimposta la password',
            paragraphs: [
                user.username ? `Ciao ${user.username},` : 'Ciao,',
                'abbiamo ricevuto una richiesta per reimpostare la password del tuo account Chi Comanda.',
            ],
            buttonLabel: 'Scegli una nuova password',
            url: `${config.baseUrl}/reset/${token}`,
            expiresInHours: config.tokenTtlHours,
            note: "Se non l'hai chiesto tu, ignora questa e-mail: la tua password resta quella di sempre.",
        }))
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
