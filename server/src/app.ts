import express from 'express'
import session from 'express-session'
import MySQLStoreFactory from 'express-mysql-session'
import path from 'path'
import passport from 'passport'
import history from 'connect-history-api-fallback'
import { createServer } from 'http'
import config from './config'
import { configurePassport } from './auth/passport'
import apiRouter, { publicRouter } from './routes'
import { asyncHandler, errorMiddleware } from './http/middleware'
import { checkHealth } from './services/health'
import { initializeSocket } from './socket'

const MySQLStore = MySQLStoreFactory(session as any)
// The `sessions` table is created by the baseline migration
const sessionStore = new MySQLStore({ ...config.db, createDatabaseTable: false } as any)

configurePassport()

const app = express()

// Before the session middleware: healthchecks must not create a session each
app.get('/api/health', asyncHandler(async (_req, res) => {
    const health = await checkHealth()
    res.set('Cache-Control', 'no-store').status(health.status === 'ok' ? 200 : 503).json(health)
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const sessionMiddleware = session({
    name: config.sessionCookieName,
    store: sessionStore,
    cookie: { maxAge: config.sessionMaxAgeMs },
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
})

app.use(sessionMiddleware)
app.use(passport.initialize())
app.use(passport.session())

app.use('/api', apiRouter)
// Public endpoints are also reachable outside /api, as in previous versions
app.use('/public', publicRouter)

// Single page application
app.use(history() as unknown as express.RequestHandler)
app.use(express.static(path.join(__dirname, 'static')))

app.use(errorMiddleware)

const server = createServer(app)
initializeSocket(server, sessionMiddleware, { path: '/socket' })

export { app, server, sessionStore }
