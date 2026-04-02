import express, { Express, Request, Response } from "express"
import session from "express-session"
import path from "path"
import passport from "passport"
import history from "connect-history-api-fallback"
import * as passportStrategy from "passport-local"
import { Strategy as GoogleStrategy } from "passport-google-oauth20"
import apiRouter from "./routes"
import publicApiRouter from "./routes/public"
import { errorMiddleware } from "./utils/asyncHandler"
import { createServer } from 'http'
import { SocketIOService } from "./socket"
import { Audit, User } from "../../models/src"
import db from "./db"
import connection from "./db/connection"
import userApi from "./api/user"
import auditApi from "./api/audit"

const AUTH_COOKIE_NAME: string = 'lp-session'

const MySQLStore = require('express-mysql-session')(session);
const options = {
    ...connection,
    createDatabaseTable: true
}
const sessionStore = new MySQLStore(options);

const app: Express = express()


app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(session({
    name: AUTH_COOKIE_NAME,
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30,
    },
    secret: process.env.SECRET || '',
    resave: false,
    saveUninitialized: true
}))
app.use(passport.initialize())
app.use(passport.session())

passport.use(new passportStrategy.Strategy(
    { usernameField: 'email', passwordField: 'password' }, async (email, password, done) => {
        try {
            if (!email) { done(null, false) }
            const user = await userApi.getByEmailAndPassword(email, password)
            done(null, user)
        } catch (e:any) {
            done(e, false, {
                message: e.message
            });
        }
    }));

passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`,
        passReqToCallback: true
    },
    async (req: any, _accessToken, _refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value || ''
            const avatar = profile.photos?.[0]?.value || ''
            const displayName = profile.displayName || email

            // Check if this is an invitation flow (token passed via state)
            const invitationToken = req.query.state as string | undefined
            let user: User
            if (invitationToken) {
                user = await userApi.acceptInvitationWithGoogle(invitationToken, profile.id, displayName, avatar)
            } else {
                user = await userApi.findOrCreateGoogleUser(profile.id, email, displayName, avatar)
            }
            done(null, user)
        } catch (e: any) {
            done(e, false)
        }
    }
))

passport.serializeUser((user, done) => {
    done(null, user)
});

passport.deserializeUser((user: User, done) => {
    done(null, user);
});


app.post("/api/login", passport.authenticate('local'), async (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
        res.json(req.user)
    } else {
        res.status(401).json("Credenziali non valide")
    }
})

app.post("/api/logout", async (req: Request, res: Response) => {
    res.clearCookie(AUTH_COOKIE_NAME)
    res.json(1)
})

app.get("/api/checkauthentication", async (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
        res.json(req.user)
    }
    else {
        res.json(0)
    }
})

// Google OAuth routes — must be before the /api auth guard
app.get('/api/auth/google', (req: Request, res: Response, next: any) => {
    const state = req.query.state as string | undefined
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        ...(state ? { state } : {})
    })(req, res, next)
})

app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=google' }),
    (req: Request, res: Response) => {
        res.redirect('/')
    }
)

app.use('/public', publicApiRouter)

app.use('/api', (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated() || /\/public\//.test(req.path)) {
        next()
    }
    else {
        res.status(401).json('Unauthorized')
    }
}, (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated() && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
        auditApi.insert({
            user_id: (req.user as any).id,
            method: req.method,
            path: req.path,
            data: req.body,
            event_id: req.body?.event_id,
            table_id: req.body?.table_id,
            order_id: req.body?.order_id
        } as Audit)
    }
    next()
}, apiRouter)


app.use(history())
app.use(express.static(path.join(__dirname, 'static')))
app.use(errorMiddleware)

// start listening

const server = createServer(app)

SocketIOService.instance().initialize(server, {
    path: "/socket"
})

SocketIOService.instance().getServer().on('connection', function (socket) {
    socket.on('end', function () {
        socket.disconnect()
    });

    socket.on('leave', async (room) => {
        await socket.leave(room)
    });

    socket.on('join', (room) => {
        socket.join(room);
    });
});

const port = process.env.PORT || 3000
server.listen(port, () => {
    console.log(`App is listening on port ${port}`)
})

process.on('SIGTERM', () => {
    console.log('SIGTERM received')
    server.close(() => {
        db.closePool().then(() => {
            console.log('Database pool closed')
            process.exit(0)
        })
    })
})