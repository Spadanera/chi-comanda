# Multi-venue — handover

One installation serves several completely separate venues. This document holds the original request, the agreed plan,
the decisions and the state of the work. Talk to the user in Italian; repo documentation is written in English.

It builds on [multi-client.md](multi-client.md): an installation (Railway project, app + MySQL) can now host N venues,
and `scripts/new-client` keeps creating installations, each with its first venue.

---

## Decisions (confirmed by the user, 3 October 2026)

1. **Coexistence** with the one-installation-per-client model: an installation hosts N venues; `new-client` creates an
   installation with its first venue.
2. **Superuser** is the platform, not a venue: it manages venues and can enter any venue with admin powers (recorded in
   the audit). It holds no per-venue roles.
3. **Branding before login** is the platform's; when the installation has a single venue, that venue's branding is used,
   so Libra looks exactly as today.
4. **Features per venue**: `venues.features` intersected with `FEATURES` (the installation's ceiling). `NULL` = every
   feature of the installation.
5. **Migration rule** from multi-client.md still applies (expand/contract): `venue_id` columns come with `DEFAULT 1`, so
   the previous release keeps writing valid rows; the default and the old `settings` table go in a later release.

## Design

### Schema

- `venues`: `id`, `name` (`NULL` = the installation's `CLIENT_NAME`, only for the venue created by the migration),
  `status`, `features`, branding (`logo`, `primary_color`, `secondary_color`, taken over from `settings`).
- `venue_id INT NOT NULL DEFAULT 1` on every domain table, children included (`tables`, `orders`, `items`,
  `master_tables_event`, `table_master_table`, `user_event`, `*_history`, `payment_*`), with an FK to `venues`.
  `types` and `sub_types` are per venue too (the admin edits them); a new venue gets copies of the defaults.
- Composite FKs `(venue_id, x_id) → parent(venue_id, id)` (parents get `UNIQUE (venue_id, id)`): the database itself
  refuses a row of venue A pointing to a row of venue B.
- `user_role.venue_id` nullable: `NULL` only for the `superuser` role. Unique `(user_id, venue_id, role_id)`.
- `audit.venue_id` nullable: `NULL` for platform actions.
- `payment_settings` unique on `(venue_id, provider)`.
- Global tables: `users`, `roles`, `sessions`, `reset`, `push_subscriptions`, `schema_migrations`, `venues`, and
  `settings` (deprecated, read only by the previous release).

### Mandatory venue context

MySQL has no row-level security, so three layers:

1. Every domain service takes a `ctx: VenueContext` (`{ venueId, userId, roles, db }`) as first argument; only the
   `requireVenue` middleware builds it (`req.ctx`).
2. Domain services can't import the raw `db` (ESLint `no-restricted-imports`); they use `ctx.db`: `find(table, id)`
   (404 when not in the venue), update/delete scoped by `venue_id` (404 on zero rows), and `query()` which throws when
   the SQL names a domain table without `venue_id`. Ids nested in request bodies always go through `find`.
3. Self-checking tests: the isolation suite fails when a route is missing from it; the schema test fails when a domain
   table lacks `venue_id` or a non-composite FK.

### Session

- The session holds only `passport.user = <id>` and `venueId`. `deserializeUser` reloads the user and the roles in the
  active venue on every request (role changes apply immediately). Old sessions (whole user object) are read by `.id`.
- `GET /api/session` (user, accessible venues, roles in the active one), `PUT /api/session/venue` (404 for a venue the
  user doesn't belong to). One venue → entered automatically.

### Socket.IO

Rooms `venue:<id>:<room>`; the client keeps asking `join('bartender')` and the server adds the prefix from the session.
`notify.*` takes the venue. Role change, venue switch or disabled venue → the user's/session's sockets are disconnected
and rejoin.

### Other

Users and invitations per venue (the venue admin invites staff); platform area for the superuser (venues, first admin,
global audit). SumUp POS callback: venue from the signed transaction. Push and broadcast only to the venue.

### Isolation tests

Two venues A and B with full data; a user with every role in A and none in B. For every route (from a table of cases,
with B's ids in path and body): **404** and B's rows unchanged. Lists never contain B's ids. A coverage test reads the
Express router stack and fails on a route missing from the table. Sockets and push don't leak across venues. Role
revoked → 403 on the next request without logging in again.

## Plan (one commit per point)

1. Migration `005`: `venues`, `venue_id` everywhere, data into venue 1, composite FKs where an FK already exists.
   Schema test.
2. Session with the id only, `requireVenue`, `VenueContext`, `/api/session`, venue choice.
3. `VenueDb` + ESLint rule; services rewritten in three commits (catalogue/destinations/rooms/master tables;
   events/tables/orders/items; payments/push/broadcast/audit/settings).
4. Users and invitations per venue, superuser platform area.
5. Socket rooms per venue.
6. Public config, branding and features per venue.
7. Client: venue choice and switch, venues management, store reset on switch.
8. Full isolation suite.
9. Docs, DEPLOY.md, stage check with the production dump restored.

No production deploy and no production DB writes without an explicit request.

## State

- **Point 1 done** (branch `multi-venue`): migration `005_venues.sql`. Venue 1 takes the branding of `settings`
  (`name` `NULL` → `CLIENT_NAME`, as before). Superuser role rows have `venue_id = NULL`; exact duplicate role rows are
  removed before the unique key. Tests in `migrations.test.ts`: production-shaped DB → everything in venue 1; schema
  test (every non-global table has `venue_id` + FK to `venues`, every FK between venue tables is composite); a
  cross-venue insert is refused. The whole suite passes on the new schema with the current code, i.e. the previous
  release keeps working (expand/contract).
  Note for point 2: a rollback release assigning roles writes the `superuser` row with `venue_id = 1`; the new code
  treats the `superuser` role as global whatever its `venue_id`.
- **Point 2 done**: the session holds `passport.user = <id>` and `venueId`; `deserializeUser` (and the socket `join`)
  call `userService.getSessionUser(id, venueId)`, which returns `undefined` for an account no longer `ACTIVE` (the
  session ends). Session user: `superuser`, `venueId` (`null` = choose), `venues: [{id, name, roles}]`, `roles` = roles
  in the active venue (+ `superuser`). **Change to the plan:** no `GET /api/session`; `/api/checkauthentication` and the
  login response return that user. `PUT /api/session/venue {venueId}` (404 for a venue the user can't enter) also
  disconnects the session's sockets. `src/venue/context.ts`: `VenueContext`, `requireVenue` (409 "Nessun locale
  selezionato" when `venueId` is null), `ctx(req)`. In `routes/index.ts` the platform routes (`/users`, `/audit`,
  `/profile`, `/users-public`) come before `requireVenue`. Audit: `venue_id` from the context (`NULL` on platform
  routes), `path` always relative to `/api`. The superuser keeps passing every role check inside a venue (as today).
  Tests: `session-venue.test.ts`, plus a socket test on a revoked role. `resetDatabase()` now removes venues > 1 and
  their rows.
- **Point 3 done** (commits `71a56e5`, `71810da` and the next one). **Changes to the plan:**
  - No ESLint on the server: the rule is `test/architecture.test.ts`, which fails when a service outside
    `PLATFORM_SERVICES` (`audit`, `health`, `profile`, `user`, `venue`) imports the raw `db`.
  - Queries use the token `:venue`, replaced by `VenueDb` with the session's venue id (never a request value).
    `assertScoped` counts FROM/JOIN/UPDATE/INTO references to venue tables and requires as many `:venue`, e.g.
    `JOIN destinations ON destinations.venue_id = :venue AND ...`. `VENUE_TABLES` is checked against the schema.
  - `VenueDb`: `find` (404), `ensure` (ids from bodies, 404), `executeOne` (404 on no matched row; mysql2 counts matched
    rows, tested), `transaction`. Shared SQL fragments in `db/sql.ts` carry `:venue`.
  - Branding moved from `settings` to `venues` here (part of point 6): the admin edits the active venue; public
    config/manifest/logo show the session's venue, else the only active venue, else the platform (name `null`). Logo
    URLs are `/api/public/logo/<size>.png?venue=<id>&v=<version>`; a `venue` other than the one the request sees is a
    404. A previous release reads `settings`: branding changed after the release is not seen by a rollback.
  - The audit stays a platform service (written by the middleware with the venue, read by the superuser with the
    venue name).
  Fixes found along the way: the event start/close no longer clears every venue's layout; discounts went to
  destination 1 (venue 1's), now to the venue's first destination; `item.update` took the table id from the body, now
  from the stored item; an order on an existing table checks that the table is the event's; event staff must hold a
  role in the venue (or be the superuser). The POS callback works in the venue of the signed transaction
  (`venueService.venueOfPaymentTransaction`). Push payloads carry `venueId` (used by the client in point 7).
  `GET /api/master-tables/:id` keeps answering `0` for a missing table, and so for another venue's (same answer as a
  missing id).
- **Point 4 done**. Staff per venue: `/api/users` is now behind `requireVenue` and works on the active venue
  (`staffService`): list of members (pending invitations included), roles in the venue (`superuser` only granted by
  the superuser, globally), invite (an existing account is just added to the venue, with an "Ora lavori anche a …"
  e-mail; a new e-mail gets the invitation link naming the venue), remove from the venue (the account is deleted only
  when no role is left anywhere, as before), account status (`ACTIVE`/`BLOCKED`, as the client sends).
  `/api/events/users` lists the venue's active members and the superusers. Platform (`/api/platform`, superuser, no
  venue): `GET/POST/PUT venues` (a new venue gets the baseline catalogue: 2 types, 8 sub types, "Menu Principale";
  `admin_email` invites its first admin; `features` is validated against `FEATURES`), `GET users` (with their venues),
  `PUT users/:id/status`, `PUT users/:id/superuser`, `DELETE users/:id`. Tests: `staff-platform.test.ts`.
  **Open question for the user:** user management stays superuser-only, as today (Libra unchanged). With several
  venues the venue admin could manage their own staff: it is `requireRole(Roles.superuser)` → `requireRole(Roles.admin)`
  on `/api/users` in `routes/index.ts`, plus the client menu entry.
- **Checked on real data (3 Oct)**: the production dump of 3 October restored locally into database `prodcopy` of the
  `libra-restore-check` container (plus the additive part of the old `release.sql`, as production has it). Orphans: none
  for the existing FKs, none for the new ones in `005`, 4 for `items.master_item_id` (items of deleted products: no FK
  there). No duplicate role rows. Migrations `002`–`005` applied on a copy in about 15 s: 346 events and 34,041
  `items_history` rows in venue 1, 3 superuser rows with `venue_id NULL`, 46 FKs. The copy on the test server was
  dropped afterwards; `prodcopy` stays in the local container.
  Not given an FK because the code deletes the parent and keeps the child: `items.master_item_id`,
  `master_items.sub_type_id`, `payment_transactions` (closing an event deletes its tables).
- **Bug to fix in point 3**: `eventService` runs `DELETE FROM table_master_table` and `DELETE FROM master_tables_event`
  with no condition (starting/closing an event): with several venues it would wipe every venue's event layout.

---

## Original request (verbatim, in Italian)

> Voglio rendere l'app multi-locale: un'unica installazione che serve più locali completamente separati. Prima di
> scrivere codice proponimi un piano.
>
> Requisiti:
> - Nuova tabella venues. Ogni dato di dominio appartiene a un locale: eventi, sale, tavoli master, menu, catalogo,
>   destinazioni, impostazioni di pagamento, broadcast, audit.
> - Un utente può lavorare in più locali con ruoli diversi: user_role diventa per locale. Il superuser resta globale ed
>   è la piattaforma, non il locale.
> - Il locale attivo sta in sessione. Ogni query dei servizi deve filtrare per venue_id: preferisco che sia impossibile
>   dimenticarlo, per esempio passando un contesto obbligatorio ai servizi, piuttosto che affidarsi alla disciplina.
> - Le stanze Socket.IO sono per locale (es. venue:12:bartender).
> - Migrazione dei dati esistenti in un locale di default.
> - Test d'isolamento: per ogni risorsa, un utente del locale A non può leggere né modificare dati del locale B (404,
>   non 403).
> - Le sessioni tengono solo l'id utente e ricaricano ruoli e locale a ogni richiesta, così un cambio di ruolo vale
>   subito.
