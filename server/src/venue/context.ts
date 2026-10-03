import { NextFunction, Request, Response } from 'express'
import { User } from '../../../models/src'
import { ConflictError, UnauthorizedError } from '../http/errors'
import { VenueDb } from './db'
import { Feature } from '../features'

/**
 * The venue a request works on. Every domain service takes it as first argument, so a query can't be written without
 * knowing the venue; only `requireVenue` builds it, from the session.
 */
export interface VenueContext {
    readonly venueId: number
    /** `null` for work done on behalf of nobody, e.g. a payment provider's callback. */
    readonly userId: number | null
    /** Roles held in the venue (plus `superuser` for the platform). */
    readonly roles: readonly string[]
    /** Functions active in the venue (its own list within the installation's). */
    readonly features: ReadonlySet<Feature>
    /** The only way domain services reach the database. */
    readonly db: VenueDb
    /**
     * Side effects of an operation (socket notifications, push): run at once, or after the commit when the operation
     * runs inside an outer transaction (`inTransaction`, used by idempotent requests). `fn` gets a context on the pool.
     */
    afterCommit(fn: (ctx: VenueContext) => unknown): void
}

export function venueContext(venueId: number, userId: number | null, roles: readonly string[], features: Iterable<Feature>): VenueContext {
    const ctx: VenueContext = Object.freeze({
        venueId, userId, roles: Object.freeze([...roles]), features: new Set(features), db: new VenueDb(venueId),
        afterCommit: (fn: (ctx: VenueContext) => unknown) => { fn(ctx) },
    })
    return ctx
}

/**
 * Runs `work` in one transaction with a context whose queries all join it (services' own `ctx.db.transaction` just
 * run inside); the side effects registered with `afterCommit` run only once it has committed.
 */
export async function inTransaction<T>(ctx: VenueContext, work: (tx: VenueContext) => Promise<T>): Promise<T> {
    const pending: ((ctx: VenueContext) => unknown)[] = []
    const result = await ctx.db.transaction(db => work(Object.freeze({
        ...ctx, db, afterCommit: (fn: (ctx: VenueContext) => unknown) => { pending.push(fn) },
    })))
    for (const fn of pending) {
        try {
            fn(ctx)
        } catch (error) {
            console.error('After commit:', error)
        }
    }
    return result
}

declare global {
    namespace Express {
        interface Request {
            venueContext?: VenueContext
        }
    }
}

/** Builds the venue context of the request; 409 when the user has not chosen a venue yet (or can enter none). */
export const requireVenue = (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user as User | undefined
    if (!req.isAuthenticated() || !user) {
        return next(new UnauthorizedError())
    }
    if (!user.venueId) {
        return next(new ConflictError('Nessun locale selezionato'))
    }
    req.venueContext = venueContext(user.venueId, Number(user.id), user.roles || [], user.features || [])
    next()
}

/** The venue context of a request that went through `requireVenue`. */
export function ctx(req: Request): VenueContext {
    if (!req.venueContext) {
        throw new Error(`${req.method} ${req.originalUrl} has no venue context: mount it behind requireVenue`)
    }
    return req.venueContext
}
