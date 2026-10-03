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
- **Open**: composite FKs that don't exist today (`table_master_table`, `payment_transactions`,
  `user_event.destination_id`, `master_items.sub_type_id`) need an orphan check on a copy of the production dump before
  they can go into a migration (a failing migration stops the server).

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
