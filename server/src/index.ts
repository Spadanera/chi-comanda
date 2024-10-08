import express, { Express, Request, Response } from "express"
import session from "express-session"
import path from "path"
import passport from "passport"
import * as passportStrategy from "passport-local"
import UserApi from "./api/user"
import apiRouter from "./routes"
import { createServer } from 'http'
import { SocketIOService } from "./socket"
import { User } from "../../models/src" 

const AUTH_COOKIE_NAME: string = 'lp-session'

const MySQLStore = require('express-mysql-session')(session);
const options = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
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
            const api = new UserApi()
            const user = await api.getByEmailAndPassword(email, password)
            done(null, user)
        } catch (e) {
            done(e);
        }
    }));

passport.serializeUser((user, done) => {
    done(null, user)
});


passport.deserializeUser((user: User, done) => {
    const api = new UserApi()
    done(null, user);
});

app.post("/api/login", passport.authenticate('local'), async (req: Request, res: Response) => {
    res.json(req.user)
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

app.use('/api', (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated()) {
        next()
    }
    else {
        res.status(401).json('Unauthorized')
    }
}, apiRouter)

app.use(express.static(path.join(__dirname, 'static')))

// start listening

const server = createServer(app)

SocketIOService.instance().initialize(server, {
    path: "/socket"
})

SocketIOService.instance().getServer().on('connection', function(socket) {
    socket.on('end', function(room) {
        socket.disconnect()
    });

    socket.on('join', function(room) {
        socket.join(room);
    });
});

server.listen(process.env.PORT, () => {
    console.log(`App is listening on port 3000`)
})