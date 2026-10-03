# Production release checklist

**The one list of what production is waiting for.** Every conversation or branch that leaves work for production adds
it here (on `main`), and ticks it when done. Details live in the linked documents; procedures in
[DEPLOY.md](../DEPLOY.md).

## State (3 October 2026)

- **Production** (Libra, `chicomanda.com`, branch `production`): v1.19.3, released 3 Oct 05:36. Prices still `DOUBLE`,
  no `schema_migrations` table yet.
- **`main`**: 11 commits ahead of `production` (the multi-client work, [multi-client.md](multi-client.md)).
- **`multi-venue`**: merged into `main` on 3 Oct and released on stage as v1.20.0 ([multi-venue.md](multi-venue.md)).
  So `main` now carries release A and release B together.
- Other branches (`claude/*` worktrees, `refactor/structure`): nothing that is not on `main`.

## Release A — `main` (multi-client) → production

What it brings: versioned migrations (`001` baseline recorded, `002` token dates `DATETIME`, `003` prices
`DECIMAL(10,2)`, `004` settings), per-installation configuration and branding, `/api/health` as Railway healthcheck,
optional Sentry, secure session cookie and required config, Node 22.

- [ ] `SECRET` and `BASE_URL` set on the production service (checked read-only on 3 Oct: present).
- [ ] **Rotate `SECRET`** on the release day: it was `pippopluto`, the public dev value. Everybody logs in again.
- [ ] Backup of the production DB right before (`scripts/backup-client`).
- [ ] Rehearsal on stage with a fresh copy of production (done for `002`–`004` on 3 Oct; repeat if `main` changed).
- [ ] Release on a closing day: `npm run deploy-stage-patch`, check stage, `npm run deploy-production`.
- [ ] Before the release, check that the production MySQL is not `SLEEPING` (`railway deployment list --service MySQL`
      from a folder linked to production): App Sleeping off applies only from the next deployment of the service.
- [ ] After: `curl -s https://chicomanda.com/api/health` → `"migration":"004_settings.sql"`; log in, open an event.
- [ ] Optional: `SENTRY_DSN`, `SENTRY_CLIENT_DSN` on the production service.

## Release B — `multi-venue` → `main` → production

What it brings: venues (migration `005_venues.sql`), session with the user id only, staff per venue, platform page,
real-time rooms per venue, new e-mails.

- [x] User's local test done; `multi-venue` merged into `main` (3 Oct).
- [x] On stage: v1.20.0 (`d041591`) deployed on 3 Oct on the staging DB (a production copy of 3 Oct morning, already
      at `004`): `005` applied, `/api/health` OK. The first try failed with `connect ETIMEDOUT`: the staging MySQL was
      sleeping again (its deployment dated from before App Sleeping was turned off); redeploying MySQL fixed it.
- [ ] The user checks the app on stage.
- [ ] Release on a closing day (it can go with release A, but separately is easier to check and roll back).
- [ ] **Rollback needs one more step**: after redeploying the previous version, `DELETE FROM sessions;` (old sessions
      held the whole user, new ones only the id). See DEPLOY.md, *The multi-venue release*.
- [ ] **No second venue until the release is confirmed** (a rollback would mix the roles of different venues).
- [ ] After: `/api/health` → `005_venues.sql`; Libra looks as before (single venue); invite e-mails look right.

## Release C — unstable networks (branch `resilience`)

What it brings: idempotency keys (migration `006_idempotency_keys.sql`), README *Unstable networks*.

- [ ] Migration `006` only adds the `idempotency_keys` table. A rollback needs nothing more: the previous release
      ignores the table and the `Idempotency-Key` header.
- [ ] After: `/api/health` → `006_idempotency_keys.sql`.

## Later (never in the same release as the one they depend on)

- [ ] Contract migration after release B is confirmed: drop `DEFAULT 1` from the `venue_id` columns, drop the
      `settings` table.
- [ ] Before **1 December 2026**: `railway.json` → `.railway/railway.ts` (`railway config migrate`), keeping the
      healthcheck path.
- [ ] Production project: 4 detached volumes (`zebra-volume`, `instrument-volume`, `porter-volume`, `size-volume`),
      the user decides whether to delete them.
- [ ] Move Libra to `libra.chicomanda.com` (DEPLOY.md, *Moving a client to another domain*).
- [ ] First real run of `scripts/new-client`.
