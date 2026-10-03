import { Router, Request, Response, NextFunction } from 'express'
import passport from 'passport'
import config from '../config'
import { User } from '../../../models/src'
import { isGoogleEnabled, loadSessionUser } from '../auth/passport'
import { asyncHandler, currentUser, currentUserId, requireAuthentication } from '../http/middleware'
import { toId } from '../http/validate'
import { NotFoundError, UnauthorizedError } from '../http/errors'
import { disconnectSession } from '../socket'

const authRouter = Router()

authRouter.post('/login', (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', (error: Error | null, user: Express.User | false, info?: { message?: string }) => {
        if (error) return next(error)
        if (!user) return next(new UnauthorizedError(info?.message || 'Credenziali non valide'))
        req.logIn(user, loginError => {
            if (loginError) return next(loginError)
            req.session.venueId = (user as User).venueId ?? undefined
            res.json(user)
        })
    })(req, res, next)
})

/** Switches the venue the user works in. A venue the user can't enter doesn't exist for them: 404. */
authRouter.put('/session/venue', requireAuthentication, asyncHandler(async (req, res) => {
    const venueId = toId(req.body?.venueId, 'venueId')
    if (!currentUser(req).venues?.some(v => v.id === venueId)) {
        throw new NotFoundError()
    }
    req.session.venueId = venueId
    const user = await loadSessionUser(req, currentUserId(req))
    // Sockets joined the rooms of the previous venue: they reconnect and join again
    disconnectSession(req.session.id)
    res.json(user)
}))

authRouter.post('/logout', (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.session.id
    req.logout(logoutError => {
        if (logoutError) return next(logoutError)
        disconnectSession(sessionId)
        req.session.destroy(() => {
            res.clearCookie(config.sessionCookieName)
            res.json(1)
        })
    })
})

authRouter.get('/checkauthentication', (req: Request, res: Response) => {
    res.json(req.isAuthenticated() ? req.user : 0)
})

authRouter.get('/auth/google', (req: Request, res: Response, next: NextFunction) => {
    if (!isGoogleEnabled()) return next(new NotFoundError())
    const state = req.query.state as string | undefined
    passport.authenticate('google', { scope: ['profile', 'email'], ...(state ? { state } : {}) })(req, res, next)
})

authRouter.get('/auth/google/callback', (req: Request, res: Response, next: NextFunction) => {
    if (!isGoogleEnabled()) return next(new NotFoundError())
    passport.authenticate('google', { failureRedirect: '/login?error=google' })(req, res, () => res.redirect('/'))
})

export default authRouter
