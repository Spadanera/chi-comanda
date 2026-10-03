import { placeholders } from '../db'
import config from '../config'
import sendEmail, { actionEmail } from '../utils/mail'
import { User } from '../../../models/src'
import { Roles } from '../http/middleware'
import { BadRequestError, ForbiddenError, NotFoundError } from '../http/errors'
import { VenueContext } from '../venue/context'
import userService from './user'
import { disconnectUser } from '../socket'

/** Roles held inside a venue; `superuser` belongs to the platform. */
export const VENUE_ROLES: string[] = [Roles.admin, Roles.checkout, Roles.waiter, Roles.bartender, Roles.client]

/** Roles of `users.id` in the venue, as a JSON array; the platform's superuser is listed too. */
const ROLES_JSON = `(
    SELECT JSON_ARRAYAGG(roles.name)
    FROM user_role
    INNER JOIN roles ON roles.id = user_role.role_id
    WHERE (user_role.venue_id = :venue OR roles.name = 'superuser') AND user_role.user_id = users.id
)`

/** `users.id` holds a role in the venue. */
const IS_MEMBER = `EXISTS (SELECT 1 FROM user_role WHERE user_role.venue_id = :venue AND user_role.user_id = users.id)`

/** `users.id` is the platform's superuser. */
const IS_SUPERUSER = `EXISTS (
    SELECT 1 FROM user_role INNER JOIN roles ON roles.id = user_role.role_id
    WHERE user_role.user_id = users.id AND roles.name = 'superuser' AND (user_role.venue_id IS NULL OR user_role.venue_id = :venue)
)`

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

/** The people working in a venue and their roles there. */
class StaffService {
    /** Members of the venue, pending invitations included. */
    async getAll(ctx: VenueContext): Promise<User[]> {
        const users = await ctx.db.query<User>(`
            SELECT id, username, email, status, avatar, ${ROLES_JSON} AS roles
            FROM users
            WHERE IFNULL(status, '') != 'DELETED' AND ${IS_MEMBER}
            ORDER BY username, email`)
        return users.map(u => ({ ...u, roles: u.roles || [] }))
    }

    /** Active members of the venue (and superusers): the people that can be staffed on an event. */
    getAvailable(ctx: VenueContext): Promise<User[]> {
        return ctx.db.query(`
            SELECT id, username, avatar, ${ROLES_JSON} AS roles
            FROM users
            WHERE status = 'ACTIVE' AND (${IS_MEMBER} OR ${IS_SUPERUSER})`)
    }

    private async venueName(ctx: VenueContext): Promise<string> {
        const venue = await ctx.db.queryOne<{ name: string | null }>('SELECT name FROM venues WHERE id = :venue')
        return venue?.name || config.client.name || 'Chi Comanda'
    }

    /** Venue roles to assign; `superuser` only when the platform's superuser asks. */
    private validateRoles(ctx: VenueContext, roles: unknown): { venueRoles: string[], superuser: boolean } {
        if (!Array.isArray(roles) || !roles.every(r => typeof r === 'string')) {
            throw new BadRequestError('Ruoli non validi')
        }
        const unknown = roles.filter(r => r !== Roles.superuser && !VENUE_ROLES.includes(r))
        if (unknown.length) {
            throw new BadRequestError(`Ruolo sconosciuto: ${unknown.join(', ')}`)
        }
        const superuser = roles.includes(Roles.superuser)
        if (superuser && !ctx.roles.includes(Roles.superuser)) {
            throw new ForbiddenError()
        }
        return { venueRoles: [...new Set(roles.filter(r => r !== Roles.superuser))], superuser }
    }

    private async assignVenueRoles(ctx: VenueContext, userId: number, roles: string[]) {
        await ctx.db.transaction(async tx => {
            await tx.execute('DELETE FROM user_role WHERE venue_id = :venue AND user_id = ?', [userId])
            if (roles.length) {
                await tx.execute(`
                    INSERT INTO user_role (venue_id, user_id, role_id)
                    SELECT :venue, ?, id FROM roles WHERE name IN (${placeholders(roles)})`, [userId, ...roles])
            }
        })
    }

    /** A member of the venue; the superuser may also reach any user of the platform. 404 otherwise. */
    private async findUser(ctx: VenueContext, id: unknown): Promise<User> {
        const user = await ctx.db.queryOne<User>(`
            SELECT id, email, status, ${IS_MEMBER} is_member FROM users WHERE id = ? AND IFNULL(status, '') != 'DELETED'`, [id])
        if (!user || (!(user as any).is_member && !ctx.roles.includes(Roles.superuser))) {
            throw new NotFoundError()
        }
        return user
    }

    async updateRoles(ctx: VenueContext, input: User): Promise<void> {
        const user = await this.findUser(ctx, input.id)
        const { venueRoles, superuser } = this.validateRoles(ctx, input.roles || [])
        await this.assignVenueRoles(ctx, user.id!, venueRoles)
        if (ctx.roles.includes(Roles.superuser)) {
            await userService.setSuperuser(user.id!, superuser)
        }
        // Open screens rejoin their rooms with the new roles
        disconnectUser(user.id!)
    }

    /**
     * Invites an e-mail to the venue with the given roles: a new account (or a pending invitation, with a fresh
     * token) gets the invitation link; an existing account is simply added to the venue.
     */
    async invite(ctx: VenueContext, input: User): Promise<void> {
        const email = typeof input?.email === 'string' ? input.email.trim() : ''
        if (!email) {
            throw new BadRequestError('Email mancante')
        }
        const { venueRoles, superuser } = this.validateRoles(ctx, input.roles || [])
        const target = await userService.issueInvitation(email)
        if ('active' in target) {
            const [member] = await ctx.db.query('SELECT 1 FROM user_role WHERE venue_id = :venue AND user_id = ?', [target.userId])
            if (member) {
                throw new BadRequestError('Utente già esistente')
            }
        }
        await this.assignVenueRoles(ctx, target.userId, venueRoles)
        if (superuser) {
            await userService.setSuperuser(target.userId, true)
        }

        const venue = escapeHtml(await this.venueName(ctx))
        await sendEmail('active' in target
            ? {
                to: email,
                subject: `Ora lavori anche a ${venue}`,
                html: actionEmail({
                    title: `Sei stato aggiunto a ${venue}`,
                    intro: `Da ora puoi lavorare anche a ${venue} su Chi Comanda, con il tuo solito account.`,
                    action: 'Accedi e scegli il locale:',
                    buttonLabel: 'Apri Chi Comanda',
                    url: `${config.baseUrl}/login`,
                }),
            }
            : {
                to: email,
                subject: `Unisciti a ${venue} su Chi Comanda`,
                html: actionEmail({
                    title: 'Sei stato invitato ad unirti a Chi Comanda!',
                    intro: `Sei stato invitato a lavorare a ${venue} su Chi Comanda.`,
                    action: "Per accettare l'invito e impostare la tua password, clicca sul pulsante qui sotto:",
                    buttonLabel: 'Accetta invito',
                    url: `${config.baseUrl}/invitation/${target.token}`,
                }),
            })
    }

    /**
     * Removes the user from the venue. An account left without any role, in any venue or on the platform, is
     * deleted, as before venues existed.
     */
    async remove(ctx: VenueContext, id: number): Promise<void> {
        const user = await this.findUser(ctx, id)
        await this.assignVenueRoles(ctx, user.id!, [])
        if (!(await userService.hasAnyRole(user.id!))) {
            await userService.delete(user.id!)
        }
        disconnectUser(user.id!)
    }

    /** Account status (ACTIVE / BLOCKED) of a member: it applies to every venue of the account. */
    async updateStatus(ctx: VenueContext, input: User): Promise<number> {
        const user = await this.findUser(ctx, input.id)
        const result = await userService.updateStatus({ id: user.id, status: input.status })
        disconnectUser(user.id!)
        return result
    }
}

export default new StaffService()
