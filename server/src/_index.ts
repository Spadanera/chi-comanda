import express, { Express, Request, Response } from "express"
import session from "express-session"
import path from "path"
import passport from "passport"
import { createServer } from 'http'

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
    name: 'lp-session',
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

app.use(express.static(path.join(__dirname, 'static')))

// start listening

const server = createServer(app)

server.listen(3000, () => {
    console.log(`App is listening on port 3000`)
})