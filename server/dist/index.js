"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const path_1 = __importDefault(require("path"));
const passport_1 = __importDefault(require("passport"));
const http_1 = require("http");
const MySQLStore = require('express-mysql-session')(express_session_1.default);
const options = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    createDatabaseTable: true
};
const sessionStore = new MySQLStore(options);
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, express_session_1.default)({
    name: 'lp-session',
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30,
    },
    secret: process.env.SECRET || '',
    resave: false,
    saveUninitialized: true
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.use(express_1.default.static(path_1.default.join(__dirname, 'static')));
// start listening
const server = (0, http_1.createServer)(app);
server.listen(3000, () => {
    console.log(`App is listening on port 3000`);
});
