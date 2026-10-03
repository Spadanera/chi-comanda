# Ludo Project - Web App

App for handling order in a bar

## Run the application

To run the application it is necessary docker and docker-compose installed on your machine. Moreover you need Grunt installed globally

First of all, clone this repository. After that run the following command in the root folder:

```
npm build
```

The application is using Mailjet to send email (invitatation and reset password). Before starting, you have to create an .env file in the root of the project with the following evn variable:

```
MAIL_API_KEY=[your mailjet api key]
MAIL_API_SECRET=[your mailjet api secret]
```

On the first start the server creates the database schema and fills it with demo data (`server/seeds/demo.sql`,
enabled by `DEMO_SEED=true` in docker-compose), including a superuser: put your e-mail address there before the first
start, so you can do the reset password procedure for it.

```
npm start
```

After that you can access the application at:

http://localhost

You need to do the reset password procedure to access the website

## Server tests

Integration tests run the real Express app against a disposable MySQL; before the suites run, the migrations and the
demo seed are applied to it, as the server does at startup:

```
cd server
npm run test:db   # starts mysql:9 on port 3317 (wait ~20s on first start)
npm test
```

## Per-installation configuration

Every client has its own installation (Railway project, app and MySQL), all deployed from the same code and the same
branch: differences between clients are configuration only, never code that checks the client's name.

| Variable | Meaning |
|---|---|
| `CLIENT_NAME` | Name of the venue, shown until the admin sets one in *Amministrazione → Impostazioni* |
| `CLIENT_SLUG` | Short id of the installation (e.g. `libra`, as in `libra.chicomanda.com`) |
| `FEATURES` | Comma separated list of the active functions: `payments`, `push`, `google-login`, `broadcast`, `minimum-consumption`, `premium`. **Unset = all on**; empty = all off; an unknown name stops the startup |

A switched-off function disappears from the interface and its API routes answer 404. A customisation wanted by one
client is added as a new function in `server/src/features.ts` (and `Feature` in `models/src`), switched on by
`FEATURES`.

Name, logo and theme colours are changed by the admin from *Amministrazione → Impostazioni* (`settings` table). The
client reads everything at startup from `GET /api/public/config`; the web app manifest
(`/api/public/manifest.webmanifest`) carries the venue name and logo, so the installed app looks like the venue's.

## Database migrations

The schema lives in `server/migrations/NNN_name.sql`. At startup, before accepting requests, the server applies the
files not yet recorded in the `schema_migrations` table, in order, holding a MySQL lock (`GET_LOCK`) so that two
instances starting together don't run them twice. If a migration fails the server exits and does not start.

- `001_baseline.sql` is the production schema of 3 October 2026 plus the generic seed (roles, types, main menu). On a
  database that already has the `users` table it is only recorded as applied (`executed = 0`); on an empty database
  it creates everything.
- To change the schema add the next number, e.g. `004_table_notes.sql`. Never edit a file that has been released.
- **Expand/contract**: a migration may only require the code of the previous release. Add tables and nullable
  columns, widen types; renames and drops come in a later release, once no deployed code uses the old shape. This way
  a rollback is just redeploying the previous version, which keeps working on the newer schema.
- MySQL commits every DDL statement on its own: a migration that fails halfway is not rolled back. Keep each file
  small, and prefer statements that can be re-run.

Google login and e-mails are optional: without `GOOGLE_CLIENT_*` / `MAIL_*` the server starts with those features disabled.

## Docker structure

There are 4 services defined in docker compose:

1. client: node18 image that hosts the client of the application based on VUE.js
2. server: node:18 image that hosts the API 
3. server-database: MySql image
4. proxy: nginx image that works as proxy between client and server