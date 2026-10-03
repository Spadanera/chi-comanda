import { Request } from 'express'
import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import config, { isFeatureEnabled } from '../config'
import { User } from '../../../models/src'
import userService from '../services/user'
import { UnauthorizedError } from '../http/errors'

export const isGoogleEnabled = () => isFeatureEnabled('google-login') && !!(config.google.clientId && config.google.clientSecret)

export function configurePassport() {
    passport.use(new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, async (email, password, done) => {
        try {
            done(null, await userService.getByEmailAndPassword(email, password))
        } catch (e: any) {
            // Wrong credentials are a failed login; anything else (e.g. database down) is an error
            if (e instanceof UnauthorizedError) {
                done(null, false, { message: e.message })
            } else {
                done(e)
            }
        }
    }))

    if (isGoogleEnabled()) {
        passport.use(new GoogleStrategy({
            clientID: config.google.clientId,
            clientSecret: config.google.clientSecret,
            callbackURL: `${config.baseUrl}/api/auth/google/callback`,
            passReqToCallback: true,
        }, async (req, _accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || ''
                const avatar = profile.photos?.[0]?.value || ''
                const displayName = profile.displayName || email
                // An invitation token travels through the OAuth `state` parameter
                const invitationToken = req.query.state as string | undefined
                const user = invitationToken
                    ? await userService.acceptInvitationWithGoogle(invitationToken, profile.id, displayName, avatar)
                    : await userService.findOrCreateGoogleUser(profile.id, email, displayName, avatar)
                done(null, user)
            } catch (e: any) {
                done(e, false)
            }
        }))
    } else if (isFeatureEnabled('google-login')) {
        console.warn('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google login disabled')
    }

    // Only the id lives in the session; roles and venues are reloaded on every request (see loadSessionUser)
    passport.serializeUser((user, done) => done(null, (user as User).id))
    passport.deserializeUser((req: Request, stored: unknown, done: (error: unknown, user?: User | false) => void) => {
        loadSessionUser(req, stored).then(user => done(null, user ?? false), done)
    })
}

/**
 * The user of the session with the active venue. The venue lives in the session too: it is set here when the
 * user can enter a single venue, and cleared when the user can no longer enter it.
 */
export async function loadSessionUser(req: Request, stored: unknown): Promise<User | undefined> {
    // Sessions created by earlier releases hold the whole user object
    const id = Number(typeof stored === 'object' && stored !== null ? (stored as User).id : stored)
    if (!Number.isInteger(id) || id <= 0) return undefined
    const user = await userService.getSessionUser(id, req.session.venueId)
    if (user && req.session.venueId !== user.venueId) {
        req.session.venueId = user.venueId ?? undefined
    }
    return user
}

declare module 'express-session' {
    interface SessionData {
        /** Venue the user is working in. */
        venueId?: number
    }
}
