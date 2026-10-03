import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import config from '../config'
import { User } from '../../../models/src'
import userService from '../services/user'
import { UnauthorizedError } from '../http/errors'

export const isGoogleEnabled = () => !!(config.google.clientId && config.google.clientSecret)

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
    } else {
        console.warn('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google login disabled')
    }

    // The whole user (id, roles, ...) lives in the session
    passport.serializeUser((user, done) => done(null, user))
    passport.deserializeUser((user: User, done) => done(null, user))
}
