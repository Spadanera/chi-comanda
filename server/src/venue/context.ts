import { NextFunction, Request, Response } from 'express'
import { User } from '../../../models/src'
import { ConflictError, UnauthorizedError } from '../http/errors'
import { VenueDb } from './db'

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
    /** The only way domain services reach the database. */
    readonly db: VenueDb
}

export function venueContext(venueId: number, userId: number | null = null, roles: readonly string[] = []): VenueContext {
    return Object.freeze({ venueId, userId, roles: Object.freeze([...roles]), db: new VenueDb(venueId) })
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
    req.venueContext = venueContext(user.venueId, Number(user.id), user.roles || [])
    next()
}

/** The venue context of a request that went through `requireVenue`. */
export function ctx(req: Request): VenueContext {
    if (!req.venueContext) {
        throw new Error(`${req.method} ${req.originalUrl} has no venue context: mount it behind requireVenue`)
    }
    return req.venueContext
}
