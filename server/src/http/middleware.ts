import { NextFunction, Request, Response } from 'express'
import { User } from '../../../models/src'
import auditService from '../services/audit'
import { isFeatureEnabled } from '../config'
import { captureError } from '../monitoring'
import { Feature } from '../features'
import { ForbiddenError, HttpError, NotFoundError, UnauthorizedError } from './errors'

export enum Roles {
    admin = 'admin',
    checkout = 'checkout',
    waiter = 'waiter',
    bartender = 'bartender',
    superuser = 'superuser',
    client = 'client'
}

/** Roles that take part in running an event (everything except `client`). */
export const STAFF_ROLES = [Roles.admin, Roles.checkout, Roles.waiter, Roles.bartender]

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export const asyncHandler = (fn: AsyncRouteHandler) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }

/** Wraps a handler whose return value is sent back as JSON with status 200. */
export const jsonHandler = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    asyncHandler(async (req, res) => {
        res.status(200).json(await fn(req, res))
    })

export function currentUser(req: Request): User {
    if (!req.user) {
        throw new UnauthorizedError()
    }
    return req.user as User
}

export function currentUserId(req: Request): number {
    return Number(currentUser(req).id)
}

export function hasAnyRole(user: User | undefined, roles: Roles[]): boolean {
    const userRoles = user?.roles || []
    return userRoles.includes(Roles.superuser) || roles.some(r => userRoles.includes(r))
}

/** Allows the request when the user has at least one of the given roles. Superuser always passes. */
export const requireRole = (...roles: Roles[]) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
        return next(new UnauthorizedError())
    }
    next(hasAnyRole(req.user as User, roles) ? undefined : new ForbiddenError())
}

/** Routes of a function switched off on this installation don't exist: 404. */
export const requireFeature = (feature: Feature) => (_req: Request, _res: Response, next: NextFunction) => {
    next(isFeatureEnabled(feature) ? undefined : new NotFoundError())
}

export const requireAuthentication = (req: Request, _res: Response, next: NextFunction) => {
    next(req.isAuthenticated() ? undefined : new UnauthorizedError())
}

/** Records every mutating request performed by an authenticated user. */
export const auditMiddleware = (req: Request, _res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
        auditService.insert({
            user_id: (req.user as User).id,
            method: req.method,
            path: req.path,
            data: req.body,
        })
    }
    next()
}

export const errorMiddleware = (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
        if (error.status >= 500) {
            console.error(error)
            captureError(error)
        }
        return res.status(error.status).json({ message: error.message })
    }
    console.error(error)
    captureError(error)
    res.status(500).json({ message: 'Internal server error' })
}
