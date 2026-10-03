import { NextFunction, Request, Response } from 'express'
import { User } from '../../../models/src'
import { ConflictError, UnauthorizedError } from '../http/errors'

/**
 * The venue a request works on. Every domain service takes it as first argument, so a query can't be written without
 * knowing the venue; only `requireVenue` builds it, from the session.
 */
export interface VenueContext {
    readonly venueId: number
    readonly userId: number
    /** Roles held in the venue (plus `superuser` for the platform). */
    readonly roles: readonly string[]
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
    req.venueContext = Object.freeze({ venueId: user.venueId, userId: Number(user.id), roles: Object.freeze([...user.roles || []]) })
    next()
}

/** The venue context of a request that went through `requireVenue`. */
export function ctx(req: Request): VenueContext {
    if (!req.venueContext) {
        throw new Error(`${req.method} ${req.originalUrl} has no venue context: mount it behind requireVenue`)
    }
    return req.venueContext
}
