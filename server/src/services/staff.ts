import { placeholders } from '../db'
import config from '../config'
import sendEmail, { actionEmail } from '../utils/mail'
import { User } from '../../../models/src'
import { Roles } from '../http/middleware'
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors'
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

/** Names of the roles shown to people (keep in sync with `ROLE_LABELS` in client/src/services/utils.ts). */
const ROLE_LABELS: Record<string, string> = {
    admin: 'Amministratore', checkout: 'Cassiere', waiter: 'Cameriere', bartender: 'Barista', client: 'Cliente fedele',
    superuser: 'Amministratore della piattaforma',
}

/** "Cameriere e Barista" */
function describeRoles(roles: string[]): string {
    const labels = roles.map(r => ROLE_LABELS[r] || r)
    return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}` : labels[0] || ''
}

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

    /** Accounts the admin can add to the venue by picking them (see `userService.candidatesFor`). */
    getCandidates(ctx: VenueContext): Promise<User[]> {
        return userService.candidatesFor(ctx.venueId, ctx.userId!, ctx.roles.includes(Roles.superuser))
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

    /**
     * Venue roles to assign. `superuser` is the platform's: only the superuser grants or revokes it; in a venue
     * admin's request it is ignored (their screen lists it for the users that have it).
     */
    private validateRoles(ctx: VenueContext, roles: unknown): { venueRoles: string[], superuser: boolean } {
        if (!Array.isArray(roles) || !roles.every(r => typeof r === 'string')) {
            throw new BadRequestError('Ruoli non validi')
        }
        const unknown = roles.filter(r => r !== Roles.superuser && !VENUE_ROLES.includes(r))
        if (unknown.length) {
            throw new BadRequestError(`Ruolo sconosciuto: ${unknown.join(', ')}`)
        }
        const superuser = roles.includes(Roles.superuser) && ctx.roles.includes(Roles.superuser)
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

        const venue = await this.venueName(ctx)
        const given = [...venueRoles, ...(superuser ? [Roles.superuser] : [])]
        const highlight: [string, string] | undefined = given.length
            ? [given.length > 1 ? 'I tuoi ruoli' : 'Il tuo ruolo', describeRoles(given)]
            : undefined
        await sendEmail('active' in target
            ? actionEmail({
                to: email,
                subject: `Ora lavori anche con ${venue}`,
                title: `Ora fai parte dello staff di ${venue}`,
                paragraphs: [
                    target.username ? `Ciao ${target.username},` : 'Ciao,',
                    `da oggi fai parte dello staff di ${venue} su Chi Comanda. Usi il tuo solito account: niente da attivare.`,
                    'Dopo l\'accesso scegli il locale in cui lavori; puoi passare da uno all\'altro quando vuoi dal menu in alto a destra.',
                ],
                highlight,
                buttonLabel: `Apri ${venue}`,
                // The app switches to the venue named in the link, right away when already logged in
                url: `${config.baseUrl}/?venue=${ctx.venueId}`,
            })
            : actionEmail({
                to: email,
                subject: `${venue} ti invita su Chi Comanda`,
                title: `Un invito da ${venue}`,
                paragraphs: [
                    'Ciao,',
                    `${venue} ti ha invitato a far parte del suo staff su Chi Comanda, l'app con cui si gestiscono ordini, bar e cassa durante le serate.`,
                    'Per accettare scegli il nome con cui ti vedranno i colleghi e una password.',
                ],
                highlight,
                buttonLabel: "Accetta l'invito",
                url: `${config.baseUrl}/invitation/${target.token}`,
                expiresInHours: config.tokenTtlHours,
                note: 'Se scade, chiedi a chi ti ha invitato di mandarlo di nuovo.',
            }))
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

    /**
     * Account status (ACTIVE / BLOCKED) of a member. It applies to every venue of the account, so a venue admin may
     * block only an account working in their venue alone; the others are blocked by the platform.
     */
    async updateStatus(ctx: VenueContext, input: User): Promise<number> {
        const user = await this.findUser(ctx, input.id)
        if (!ctx.roles.includes(Roles.superuser)) {
            const elsewhere = await ctx.db.query(`
                SELECT 1 FROM users
                WHERE users.id = ? AND (EXISTS (
                    SELECT 1 FROM user_role WHERE user_role.venue_id != :venue AND user_role.user_id = users.id
                ) OR ${IS_SUPERUSER})`, [user.id])
            if (elsewhere.length) {
                throw new ConflictError("L'account lavora anche in altri locali: può bloccarlo solo la piattaforma")
            }
        }
        const result = await userService.updateStatus({ id: user.id, status: input.status })
        disconnectUser(user.id!)
        return result
    }
}

export default new StaffService()
