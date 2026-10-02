import { Router, Request, Response, NextFunction } from 'express'
import passport from 'passport'
import config from '../config'
import { isGoogleEnabled } from '../auth/passport'
import { NotFoundError, UnauthorizedError } from '../http/errors'
import { disconnectSession } from '../socket'

const authRouter = Router()

authRouter.post('/login', (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', (error: Error | null, user: Express.User | false, info?: { message?: string }) => {
        if (error) return next(error)
        if (!user) return next(new UnauthorizedError(info?.message || 'Credenziali non valide'))
        req.logIn(user, loginError => (loginError ? next(loginError) : res.json(user)))
    })(req, res, next)
})

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
