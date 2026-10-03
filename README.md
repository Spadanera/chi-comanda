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

Creating a client, releasing, backups and moving a client to another domain: see [DEPLOY.md](DEPLOY.md).

Every client has its own installation (Railway project, app and MySQL), all deployed from the same code and the same
branch: differences between clients are configuration only, never code that checks the client's name.

| Variable | Meaning |
|---|---|
| `CLIENT_NAME` | Name of the installation's first venue, shown until the admin sets one in *Amministrazione → Impostazioni* |
| `CLIENT_SLUG` | Short id of the installation (e.g. `libra`, as in `libra.chicomanda.com`) |
| `FEATURES` | Comma separated list of the functions the installation offers: `payments`, `push`, `google-login`, `broadcast`, `minimum-consumption`, `premium`. **Unset = all on**; empty = all off; an unknown name stops the startup. Each venue can switch some off (below) |

| `SENTRY_DSN` | Optional: server errors (5xx, failed startup) go to Sentry, tagged with the client |
| `SENTRY_CLIENT_DSN` | Optional: browser errors, sent to the client through `/api/public/config` (one build for every client) |
| `SENTRY_ENVIRONMENT` | Optional, defaults to Railway's environment name |

A switched-off function disappears from the interface and its API routes answer 404. A customisation wanted by one
client is added as a new function in `server/src/features.ts` (and `Feature` in `models/src`), switched on by
`FEATURES`.

Name, logo and theme colours are changed by the admin from *Amministrazione → Impostazioni*, for the venue they work
in (`venues` table). The client reads everything at startup from `GET /api/public/config`; the web app manifest
(`/api/public/manifest.webmanifest`) carries the venue name and logo, so the installed app looks like the venue's.
Before login (and on an installation with several venues) they are the platform's: "Chi Comanda".

## Venues

An installation serves one or more **completely separate venues** (design and decisions:
[docs/multi-venue.md](docs/multi-venue.md)). Every domain row (events, rooms, layout, menus, catalogue, destinations,
payments, audit…) has a `venue_id`; accounts are shared, and a user works in several venues with different roles
(`user_role.venue_id`). The **superuser** is the platform: it creates and disables venues and manages every account
from *Piattaforma*, and can enter any venue.

- The session holds only the user id and the active venue; roles are reloaded on every request, so a role change
  applies at once. A user with several venues chooses after login, and switches from the menu (*Cambia locale*).
- Domain services take a `VenueContext` (`server/src/venue/context.ts`) as first argument and query only through
  `ctx.db` (`VenueDb`, `server/src/venue/db.ts`): `:venue` in the SQL is the session's venue, and a query naming a venue
  table without one is refused. `test/architecture.test.ts` keeps the raw database to the platform services.
- Composite foreign keys `(venue_id, x_id)` make the database refuse a row pointing to another venue's.
- Real-time rooms are `venue:<id>:<screen>`, joined by the server from the session.
- A venue's functions are its own list within `FEATURES` (`venues.features`, `NULL` = all).
- `test/isolation.test.ts` attacks every route with another venue's ids (404 expected, nothing changed) and fails on a
  route it doesn't cover: add a case there with every new route.

## Session and required configuration

A deployed installation (`NODE_ENV=production`, or any Railway deploy, recognised by `RAILWAY_ENVIRONMENT`) refuses to
start without `SECRET` or with a missing or invalid `BASE_URL`. The session cookie (`lp-session`) is `HttpOnly`,
`SameSite=Lax`, bound to the host that set it (no `Domain`, so clients on different subdomains never share sessions)
and, when deployed, `Secure`: the app trusts the proxy's `X-Forwarded-Proto` and never sets the cookie over plain
http. Locally the cookie is not `Secure`, so the app works on `http://localhost`.

## Health check

`GET /api/health` answers 200 with the version, the commit, the client and the last migration applied, or 503 when the
database is unreachable. It is the healthcheck path in `railway.json`: Railway moves traffic to a new deploy only once
it answers 200, so a release whose migrations fail never replaces the running one.

## Unstable networks

Waiters work on phones with a weak connection: a request may reach the server while its answer is lost, and the
client cannot tell. The operations that must never happen twice are idempotent.

- **Idempotency keys**: the client sends `Idempotency-Key: <uuid>` (a new one per action of the user, kept across its
  retries) with `POST /orders`, `PUT /tables/:id/complete`, `PUT /tables/:id/payitems` and
  `POST /payment/checkout/*`. The server (`server/src/http/idempotency.ts`) writes the key in the same transaction as
  the operation, with its answer (`idempotency_keys`, unique per venue): a retry gets the stored answer with
  `Idempotent-Replayed: true`, a concurrent duplicate waits for the first and gets its answer, a failed operation frees
  the key. Socket and push notifications go out only for the real execution (`ctx.afterCommit`). The same key with
  another body, path or user is refused (422) without showing the stored answer; the same key in another venue is
  another key. Keys are forgotten after 30 days. Without the header the routes work as before.
- The client (`api.idempotent` in `client/src/services/client.ts`) retries these requests by itself, with the same key,
  after a network error or a 502/503/504 (3 times, up to ~5 s), and shows an error only after the last attempt.

Client tests (`client/test`, vitest with jsdom): `cd client && npm test`.

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

1. client: node:22 image that hosts the client of the application based on VUE.js
2. server: node:22 image that hosts the API 
3. server-database: MySql image
4. proxy: nginx image that works as proxy between client and server