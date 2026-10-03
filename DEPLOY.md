# Deploying Chi Comanda

Every client has its **own installation**: a Railway project with the app and a dedicated MySQL, reachable at
`<slug>.chicomanda.com`. An installation can also serve **several venues** (README, *Venues*): its superuser creates
them from *Piattaforma*, no new installation needed. All installations run **the same code from the same branch, `production`**: differences
between clients are configuration only (environment variables and the admin's *Impostazioni*, see the README).
`chicomanda.com` will be the showcase site, outside this repository.

| Branch | Deployed to |
|---|---|
| `main` | nothing: development |
| `stage` | project `chi-comanda`, environment `staging` (https://chi-comanda-staging.up.railway.app): your test environment |
| `production` | every client installation |

Today Libra still runs in project `chi-comanda`, environment `production`, on `chicomanda.com`; the move to
`libra.chicomanda.com` is described below.

Prerequisites on your machine: Node 18+, Docker (the MySQL client tools run in the `mysql:9` image, no local
install), the Railway CLI logged in (`railway login`).

---

## Creating a client

```bash
export CLOUDFLARE_API_TOKEN=...   # token with "DNS edit" on the chicomanda.com zone only; never in the repo
export CLOUDFLARE_ZONE_ID=...
node scripts/new-client.mjs mare --name "Bagno Al Mare" --superuser-email owner@example.com --dry-run
node scripts/new-client.mjs mare --name "Bagno Al Mare" --superuser-email owner@example.com
```

The slug is the subdomain: lowercase letters, digits and hyphens, 2-30 characters, not starting or ending with a
hyphen; `www`, `mail`, `api`, `app`, `admin`, `staging`, `stage`, `status` are reserved.

The script creates (or completes) the project `chi-comanda-<slug>` with MySQL and the `app` service on the
`production` branch, sets the variables (generating `SECRET` and the VAPID keys), turns off App Sleeping, adds
the custom domain and its DNS records on Cloudflare, waits for `/api/health`, and prints the **invitation link of
the first superuser** (valid 24 hours) and the remaining manual steps:

- Google Cloud console → the OAuth client → add the redirect URI `https://<slug>.chicomanda.com/api/auth/google/callback`;
- app variables not copied by the script: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `MAIL_API_KEY`/`MAIL_API_SECRET`/
  `MAIL_FROM`/`MAIL_FROM_NAME`, optionally `SENTRY_DSN`/`SENTRY_CLIENT_DSN`;
- the superuser sets name, logo and colours in *Amministrazione → Impostazioni*, and the payment providers;
- a first backup, and the automatic daily backups (*Automatic daily backups* below).

Options: `--features payments,push,...` (omit for every function), `--proxied` (subdomain behind the Cloudflare proxy;
needs SSL/TLS "Full", already active), `--workspace` (Railway workspace of a new project).

It is safe to run again: what exists with the same value is left alone, a different value is never overwritten
without asking. On Cloudflare it only ever creates or changes `<slug>.chicomanda.com` and the records below it that
Railway asks for (verification, certificate); it never touches the apex, MX records or existing TXT records.

**Keep App Sleeping off** on every installation (the script does it): a sleeping MySQL did not wake up on staging
and the app answered `connect ETIMEDOUT`. Turning it off applies from the **next deployment** of the service: if
`railway deployment list --service MySQL` still says `SLEEPING`, run `railway redeploy --service MySQL` (data stays on
the volume).

### Another venue in an existing installation

Log in as the superuser → avatar menu → *Piattaforma* → *Nuovo locale*: name, functions (all those of the
installation, or a subset) and optionally the e-mail of its first admin, who gets the invitation. The venue starts
with the default catalogue (types and sub types) and an empty main menu. Staff is invited from *Amministrazione →
Utenti* while working in that venue (*Cambia locale*); an existing account is simply added to the venue. Disabling a
venue hides it at once from its staff.

---

## Releasing

```bash
npm run deploy-stage-patch     # or -minor / -major: bumps the version, merges main into stage, pushes
# check the release on stage
npm run deploy-production      # merges stage into production: every client installation deploys it
```

Railway builds each installation and runs the new deploy's migrations at startup; traffic moves to it only when
`/api/health` answers 200 (healthcheck in `railway.json`). A deploy whose migrations fail never replaces the running
one. Check each installation afterwards:

```bash
curl -s https://<slug>.chicomanda.com/api/health   # version, commit, last migration
```

### A release with migrations

Migrations live in `server/migrations` and follow **expand/contract** (README, *Database migrations*): a migration
only needs the code of the previous release, so the previous release keeps working on the new schema.

1. **Backup** every client database right before the release (below).
2. **Rehearse on stage with a copy of production**: restore a fresh production backup into the staging database
   (below), `npm run deploy-stage`, check in the deploy logs that the migrations ran
   (`[migrations] 00N_...: applying`), then use the app on stage.
3. **Release on a closing day** of the clients (no service that evening), with `npm run deploy-production`.
4. **Rollback = redeploy the previous version**: Railway dashboard → service → Deployments → previous deployment →
   *Redeploy*; or revert the merge on `production` and push. The database is **not** rolled back: the previous code runs
   on the newer schema. Restore a backup only if data was damaged, and only after taking a new backup.

### The multi-venue release (migration `005_venues.sql`)

- `005` puts every existing row in venue 1, takes over the branding of `settings` and moves the superuser role to the
  platform. On a copy of Libra's production data (3 October 2026) it took about 15 seconds.
- **Rolling it back needs one more step**: the previous release stores the whole user in the session, the new one only
  its id, so after a rollback the open sessions are unreadable (no roles) until a new login. Right after redeploying
  the previous version, empty the sessions so everybody logs in again:
  `DELETE FROM sessions;` (only that table; take the backup first, as always).
- Until the release is confirmed, **create no second venue**: the previous release ignores `user_role.venue_id` and
  would give a user the roles of every venue they work in. Branding saved after the release lives in `venues` and is
  not seen by a rollback (it reads `settings`).

---

## Backups

```bash
node scripts/backup-client.mjs <slug>                                      # chi-comanda-<slug>, production
node scripts/backup-client.mjs libra --project chi-comanda                 # Libra, until it moves to its own project
node scripts/backup-client.mjs libra --project chi-comanda --environment staging
```

Two files in `~/backups/chi-comanda/` (mode 600, never inside the repository): `<slug>-YYYY-MM-DD-HHMM-full.sql`
(data, `--single-transaction`, routines and triggers) and `...-schema.sql` (structure only). Each is validated
(complete, "Dump completed" trailer, main tables present) and the last migration is printed. Only reads the database.
Backups contain personal data (staff e-mails, password hashes): keep the folder private and encrypted at rest.

### Automatic daily backups

Every installation backs itself up every night, besides the manual backups above.

- **Where it runs**: a cron service named `backup` in the installation's Railway project, built from this repository
  with `backup/Dockerfile` (`backup/railway.json`: every day at **03:30 UTC**, no restart). It runs
  `scripts/backup-cron.mjs`: `mysqldump --single-transaction` over the project's **private network** (the database
  credentials never leave Railway), the same validation as `backup-client`, then gzip, encryption, upload, and a check
  that the bucket holds the whole file. Read-only on the database. A failed run exits with an error (Railway shows it
  as failed) and, with `SENTRY_DSN`, sends an alert to Sentry.
- **Where backups are kept**: a **Cloudflare R2** bucket per installation (`chi-comanda-backup-<slug>`), outside
  Railway, as `<prefix>/<prefix>-YYYY-MM-DD-HHMM-full.sql.gz.enc` (UTC). A lifecycle rule deletes them after **30
  days**.
- **Encryption**: each backup is encrypted with a random AES-256-GCM key, itself encrypted with the **backup public
  key** (RSA). The service only has the public key: whoever reads the bucket or the service's variables can't read a
  backup. The **private key stays offline** with the owner (password manager and an encrypted disk), never on
  Railway, never in the repository. Losing it means losing every automatic backup: keep two copies.

#### Turning them on (once per installation)

1. **Key pair** (once for all installations; skip if you already have it). Outside the repository:

   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out ~/.chi-comanda/backup-private.pem
   openssl pkey -in ~/.chi-comanda/backup-private.pem -pubout -out ~/.chi-comanda/backup-public.pem
   ```

   The first command asks for a passphrase: keep it with the key. `backup-public.pem` is the only file that goes to
   Railway.
2. **Bucket** on Cloudflare → R2: create `chi-comanda-backup-<slug>`; *Settings → Object lifecycle rules*: delete
   objects after 30 days; optionally *Bucket lock rules*: retention 30 days (then not even a leaked token can delete a
   backup before it expires). *R2 → Manage API tokens → Create API token*: permission **Object Read & Write**,
   applied to **that bucket only**. Note the access key id, the secret and the S3 endpoint
   (`https://<account id>.r2.cloudflarestorage.com`): they go only into Railway's variables below.
3. **Service** on Railway, in the installation's project and environment: *New → GitHub Repo* → this repository,
   named `backup`. *Settings*: branch `production` (`stage` for the staging environment), *Config-as-code* path
   `/backup/railway.json`, no public domain. *Variables*:

   | Variable | Value |
   |---|---|
   | `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` (reference to the MySQL service: private network) |
   | `BACKUP_PUBLIC_KEY` | content of `backup-public.pem` (multi-line value, or one line with `\n`) |
   | `BACKUP_S3_ENDPOINT` | `https://<account id>.r2.cloudflarestorage.com` |
   | `BACKUP_S3_BUCKET` | `chi-comanda-backup-<slug>` |
   | `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | the R2 token |
   | `BACKUP_PREFIX` | `<slug>`, e.g. `libra`; `libra-staging` on staging |
   | `SENTRY_DSN` | optional: alerts when a backup fails (same DSN as the app) |

4. **First run**: deploy the service, then *Deployments → ⋯ → Run now* (or wait for 03:30 UTC). The log ends with
   `✓ uploaded <prefix>/...`. If the dump can't reach `mysql.railway.internal`, use `${{MySQL.MYSQL_PUBLIC_URL}}`.
5. **Restore test** (below, *From an automatic backup*), then once a month.

Check now and then that backups keep arriving (`restore-backup.mjs list`): a cron service that is never deployed
again doesn't run.

### Restoring

Restoring **replaces** the target database. Take a backup of the target first, and never restore into a client's
production database without a plan (closing day, app stopped).

Credentials are read into shell variables, never printed or saved; the password reaches the container through
`MYSQL_PWD`. Run this from a temporary directory, so the repository is never linked to a project:

```bash
cd "$(mktemp -d)"
railway link --project <project> --environment <environment> --service MySQL
eval "$(railway variable list --json | python3 -c 'import json,sys,shlex;v=json.load(sys.stdin);print("H=%s P=%s U=%s D=%s; export MYSQL_PWD=%s"%tuple(shlex.quote(v[k]) for k in ["RAILWAY_TCP_PROXY_DOMAIN","RAILWAY_TCP_PROXY_PORT","MYSQLUSER","MYSQLDATABASE","MYSQLPASSWORD"]))')"
M() { docker run --rm -i -e MYSQL_PWD mysql:9 mysql -h "$H" -P "$P" -u "$U" "$@"; }
M -e "DROP DATABASE \`$D\`; CREATE DATABASE \`$D\`"
M "$D" < ~/backups/chi-comanda/<file>-full.sql
M "$D" -e "SELECT COUNT(*) FROM users; SELECT MAX(name) FROM schema_migrations"
unset MYSQL_PWD
```

Then redeploy the app (`railway service redeploy --service <app> --yes`): it applies the migrations the backup is
missing.

#### From an automatic backup

Download and decrypt it on your machine (it lands in `~/backups/chi-comanda/`, mode 600, validated), then restore the
`.sql` file as above. The R2 token is read from the shell, never saved:

```bash
export BACKUP_S3_ENDPOINT=https://<account id>.r2.cloudflarestorage.com BACKUP_S3_BUCKET=chi-comanda-backup-<slug>
export BACKUP_S3_ACCESS_KEY_ID=... BACKUP_S3_SECRET_ACCESS_KEY=...      # a read token is enough
read -rs BACKUP_KEY_PASSPHRASE && export BACKUP_KEY_PASSPHRASE          # passphrase of the private key
node scripts/restore-backup.mjs list <prefix>
node scripts/restore-backup.mjs fetch <prefix> --key ~/.chi-comanda/backup-private.pem   # the latest
node scripts/restore-backup.mjs fetch <prefix>/<file>.sql.gz.enc --key ~/.chi-comanda/backup-private.pem
unset BACKUP_S3_SECRET_ACCESS_KEY BACKUP_KEY_PASSPHRASE
```

A file downloaded from the Cloudflare dashboard is decrypted with
`node scripts/restore-backup.mjs decrypt <file>.sql.gz.enc --key <private.pem>`. Dumps taken before `backup-client` existed (e.g. `libra-2026-10-03-full.sql`) carry a `GTID_PURGED` line:
restore them with `grep -v GTID_PURGED <file> | M "$D"`.

To check a backup without touching any server, restore it into a throw-away local container:

```bash
docker run -d --name restore-check -e MYSQL_ROOT_PASSWORD=pw -e MYSQL_DATABASE=railway mysql:9
docker exec -i restore-check mysql -uroot -ppw railway < ~/backups/chi-comanda/<file>-full.sql
docker rm -f restore-check
```

---

## Moving a client to another domain

For example Libra from `chicomanda.com` to `libra.chicomanda.com`, or a client to its own domain.

1. **New domain**: `railway domain <new> --service <app>` and create on Cloudflare the records it prints, with
   `proxied=false` (`railway domain status <new> --json` shows them again). `new-client` does this only for projects
   named `chi-comanda-<slug>`, so for Libra (project `chi-comanda`) it is done by hand. Wait for
   `https://<new>/api/health`.
2. **Variables**: `BASE_URL=https://<new>` (links in e-mails, Google callback).
3. **Google login**: add `https://<new>/api/auth/google/callback` to the OAuth client's redirect URIs; remove the old
   one only after the move.
4. **Payments**: in *Amministrazione → Pagamenti*, update the public server URL of *SumUp POS* (the callback after a
   payment goes there).
5. **Redirect 301** from the old domain to the new one, keeping path and query: a Cloudflare *Redirect Rule* on the old
   hostname (it must be proxied, orange cloud). For `chicomanda.com`, which becomes the showcase site, redirect only
   the app's paths (`/login`, `/api/*`, `/invitation/*`, `/reset/*`, `/admin*`, `/waiter*`, `/bartender*`,
   `/checkout*`, `/tables*`, `/profile`) or everything until the showcase site goes live.
6. **Tell the staff**, because some things don't move with the domain:
   - **sessions**: the cookie belongs to the host, so everybody logs in again;
   - **push notifications**: a subscription belongs to the address it was made from, so bartenders turn them on again
     from the profile at the new address; the old ones keep arriving (and open the old address, redirected) until the
     browser drops them, and the server deletes them when the push service reports them gone;
   - **installed app**: remove it from the home screen and install it again from the new address;
   - **pending invitation and reset links** point to the old address: through the 301 they keep working until it is
     removed.
7. Remove the old domain from Railway only once the redirect is in place and the staff has moved.
