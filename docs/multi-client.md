# Multi-client — handover

Handover document to resume the work in a new session: the original request, the plan agreed with the user and the
decisions taken, and the state as of 3 October 2026.

In the new session: *"read docs/multi-client.md and start from point 0"*. Talk to the user in Italian; repo
documentation is written in English.

---

## State as of 3 October 2026

- **Production (Libra, chicomanda.com)** aligned with staging: version **1.19.3**, released at 05:36.
- **Production DB**: the additive part of the old `release.sql` has been applied (`users.push_orders`,
  `user_event.destination_id`, `push_subscriptions` table, `payment_transactions.mode`). **Prices are still `DOUBLE`**:
  the conversion to `DECIMAL(10,2)` is deferred (see decisions).
- **Staging DB**: also has prices as `DECIMAL(10,2)`.
- **VAPID keys** set on the production `chi-comanda` service (dedicated pair).
- **Backups** in `~/backups/chi-comanda/` (outside the repo, mode 600), taken **before** this morning's migration:
  - `libra-2026-10-03-full.sql` (46 MB, `--single-transaction --routines --triggers`, exit 0)
  - `libra-2026-10-03-schema.sql` (structure only, exit 0)
  - Full dump **validated** (3 Oct): "Dump completed" trailer, 25 tables, restored without errors into a local
    `mysql:9` (21 users, 346 events, last one 2 Oct, ~34k `items_history` rows). No orphans for the FKs that production
    lacks (`audit.user_id`, `master_tables.room_id`); one price with float noise (`-0.9000000000000004`, `DECIMAL`
    rounds it to `-0.90`).
  - Production schema vs `init.sql` (before this morning's migration): `audit` has no FK to `users`;
    `items_history` lacks `menu_id`/`setMinimum` (never written by the code); `master_tables.room_id` is `INT` with FK
    to `rooms` (`VARCHAR(45)` without FK in `init.sql`); `table_master_table.master_table_id` is `NOT NULL` and has no
    FKs; `users.creation_date`, `users.last_login_date`, `reset.creation_date` are `DATE` (not `DATETIME`); prices
    `DOUBLE`; and the `release.sql` columns/table were missing (applied this morning).
  - **Bug found**: invitation/reset tokens are checked with `creation_date >= NOW() - INTERVAL 24 HOUR`, but in
    production `creation_date` is a `DATE`, so it is stored as midnight: an invitation sent at 22:00 expires after
    ~2 hours. Widening to `DATETIME` is a safe migration for point 1.
- **Railway CLI** installed (5.62.1) and logged in. Project `chi-comanda`, environments `production` and `staging`,
  services `chi-comanda` and `MySQL` (MySQL 9.7.2, image `mysql:9`).
  Project `precious-inspiration` is the wedding website: do not touch it.
- `mysqldump`/`mysql` are not installed locally: use the `mysql:9` docker image.

### Point 0 completed

- **Post-migration structure dump**: `~/backups/chi-comanda/libra-2026-10-03-schema-post.sql` (06:06, exit 0,
  26 tables). It is identical to `libra-2026-10-03-schema.sql` + the additive part of `release.sql`: **this file is the
  source for the baseline migration `001`**.
- How production reads are done: link the CLI to production from a temporary folder **outside the repo**
  (`railway link --project … --environment production --service MySQL`), so commands run in the repo can't hit
  production by mistake. Read credentials into shell variables inside a single command, never print or save them;
  pass the password to the docker client with `-e MYSQL_PWD` (inherited from the environment).

### Found along the way (relevant to later points)

- `NODE_ENV` is **not set** on the production service: needed before making startup fail without `SECRET`/`BASE_URL` (point 4).
- The CLI warns that `railway.json` (config as code) is deprecated: it keeps working until **1 December 2026**, then
  it must move to `.railway/railway.ts` (`railway config migrate`). Relevant for the healthcheck path (points 3 and 5).
- **MySQL Serverless (App Sleeping)**: on staging the DB went to sleep and never woke up (`connect ETIMEDOUT` from the
  app). Keep it off on every installation: document it and set it in the `new-client` script.
- The production project has **4 detached volumes** (`zebra-volume`, `instrument-volume`, `porter-volume`,
  `size-volume`): probably old databases; deleting them is the user's decision.
- Login now answers 500 (not 401) when the DB is unreachable.

---

## Decisions

1. **Migration rule**: a migration may only require the code of the previous release (expand/contract), so a rollback
   is always "redeploy the previous version". Hence the price conversion to `DECIMAL(10,2)` (`items.price`,
   `items_history.price`, `master_items.price`, `events.minimumConsumptionPrice`) ships in a **later release**: 1.19.3,
   which reads `DECIMAL` as numbers (`decimalNumbers: true`), is now in production, so the `DECIMAL` migration can go
   into the next release.
2. **`new-client` script**: tests (Railway CLI and Cloudflare mocked) and `--dry-run` only. No real run by Claude: the
   user runs the first one, or asks explicitly.

## Agreed plan (one commit per point, with tests where they make sense)

- **0** Backup and schema — done (see above).
- **1** Migrations: `server/migrations/NNN_*.sql`, `schema_migrations` table, applied at startup before `listen` under
  MySQL `GET_LOCK`; if one fails the process exits. Baseline `001` = real production schema (recorded as applied on
  existing DBs, detected by the presence of `users`; executed on empty DBs, followed by today's seed data). Then the new
  migrations (`DECIMAL` next). Remove `init.sql` and `release.sql`, update docker-compose and the test setup. Tests:
  empty DB, production-schema DB, second run, failing migration, two runners in parallel. Final check on staging with
  the production dump restored.
  **Done** (commit `12614f8`, deployed to stage on 3 Oct as merge `00add19`). Differences from the plan: the baseline
  carries only the generic seed (roles, types, sub types, main menu); Libra's rooms, tables, products and superuser moved
  to `server/seeds/demo.sql`, loaded only with `DEMO_SEED=true` (docker-compose, tests). Extra migration `002`
  (`DATE` → `DATETIME` for token dates, fixes the expiry bug), `003` is the `DECIMAL` conversion. Stage check: staging DB
  backed up to `~/backups/chi-comanda/stage-2026-10-03-before-restore.sql`, then recreated from the production dump +
  the additive part of `release.sql`; deploy applied `002`/`003`, login and admin reads (closed events from history,
  menu, layout) OK. **Production still has prices as `DOUBLE`**: `003` runs there on the next production release.
- **2** Per-installation configuration: `CLIENT_NAME`, `CLIENT_SLUG`, `FEATURES` (proposed: `payments`, `push`,
  `google-login`, `broadcast`, `minimum-consumption`, `premium`; when `FEATURES` is unset everything is on, so Libra
  doesn't change). `settings` table (name, logo, colours) with an admin page. `/api/public/config`, also carrying the
  Sentry DSN (one build for every client). `requireFeature` on the server, `useFeature` on the client, routes and menu
  entries hidden. Dynamic manifest with the venue name.
  **Done** (commit `e3e6b10`, not yet on stage). `settings` is migration `004` (single row, logo as 512px PNG blob,
  served at `/api/public/logo/{192,512,maskable}.png?v=`). `google-login` is reported to the client only if the
  Google keys are also set. Admin page *Impostazioni* (admin role). The Sentry DSN in `/api/public/config` comes with
  point 3. Not configurable yet: the PREMIUM price (fixed at 9 €, server and client).
  Deployed to stage on 3 Oct (`5469196`): migration `004` applied, config and Google login OK.
- **3** `/api/health` (DB, version, last migration) as healthcheck path; optional Sentry (`@sentry/node`,
  `@sentry/vue`) tagged with the client.
  **Done** (commit on main, stage merge `d7b7a0a`): Railway log "Healthcheck succeeded" on stage. `/api/health` is mounted
  before the session middleware (no session per check). `railway.json` rewritten with the real schema: its old
  `build`/`start` keys were ignored (start comes from the root `Procfile`, build is Nixpacks' `npm ci` + `npm run build`).
  Env: `SENTRY_DSN` (server), `SENTRY_CLIENT_DSN` (browser, served by `/api/public/config`), `SENTRY_ENVIRONMENT`.
  **Sentry 9, not 11**: Railway builds with **Node 18** (EOL since April 2025, `nodejs_18` in the Nixpacks plan) and
  Sentry 10+ needs Node 20. Upgrading Node (e.g. `engines.node` in the root `package.json`) is a separate task.
- **4** Session cookie without `domain`, `httpOnly`, `sameSite: lax`, `secure` with https + `trust proxy`; production
  startup fails without `SECRET` or `BASE_URL` (set `NODE_ENV` first).
  **Done** (stage merge `2a9a5fa`): on stage the cookie is `HttpOnly; Secure; SameSite=Lax`, no `Domain`; http is
  redirected to https by Railway; login, admin reads and logout OK. **Change to the plan:** `NODE_ENV` is *not* set on
  Railway. "Deployed" = `NODE_ENV=production` or `RAILWAY_ENVIRONMENT` (injected by Railway on every deploy), because
  NODE_ENV is also a build-time variable there and would make `npm install` skip the devDependencies the build needs.
  Before the next production release: confirm that the production service has `SECRET` and `BASE_URL` (names only),
  otherwise the new deploy fails its healthcheck and the old one keeps serving. Not verified end-to-end: Google login
  with `SameSite=Lax` (top-level redirect, so the cookie is sent).
- **5** Idempotent `scripts/new-client <slug>` with `--dry-run` (Railway CLI + Cloudflare API, superuser via
  invitation, summary of the manual steps, MySQL Serverless off).
  **Cloudflare DNS rules (added by the user on 3 Oct):**
  - The script may create or change only the record named `<slug>.chicomanda.com` and the verification records Railway
    asks for that subdomain. It must never touch the apex `chicomanda.com` nor any existing MX or TXT record (email
    routing, SPF, DKIM, Mailjet).
  - Refuse reserved or invalid slugs: `www`, `mail`, `api`, `app`, `admin`, `staging`, `stage`, `status`, and any slug
    that is not lowercase `[a-z0-9-]`, 2-30 characters, or that starts or ends with a hyphen.
  - New subdomains are created with `proxied=false`; a `--proxied` option creates them with the Cloudflare proxy on
    (needs SSL/TLS in Full mode, already active on the domain).
  **Done** (commit `c0691b7`, `scripts/new-client.mjs` + `scripts/lib/`, tests `npm run test:scripts`, 25, all mocked).
  Never run for real: only `--dry-run` on a non-existent project. JSON shapes checked against the real CLI:
  `railway list`, `service list`, `variable list` (object), `environment config` (services by id, `deploy.sleepApplication`).
  Not checkable without a real run: the output of `railway domain status` for a *custom* domain (parsed by searching
  `dnsRecords` / `verificationDnsHost` / `verificationToken`, per the GraphQL schema), `railway init` with `--workspace`,
  `environment edit --service-config <svc> deploy.sleepApplication false`. The healthcheck path comes from `railway.json`.
  Staging has `sleepApplication: true` on both services (the cause of the sleeping DB): not changed.
- **6** `scripts/backup-client <slug>` and `DEPLOY.md`.
  **Done** (commit `1ae66f4`): `scripts/backup-client.mjs` (+ `scripts/lib/backup.mjs`, tests in `scripts/test/`, 33 in
  total) and `DEPLOY.md`. Tried for real on staging (`libra --project chi-comanda --environment staging`): 44 MB,
  28 tables, last migration `004`, restored into a local `mysql:9` without errors. Dumps now use
  `--set-gtid-purged=OFF`, so they restore without removing the GTID line.

**Production release check (3 Oct, read-only):** production service has `SECRET`, `BASE_URL`
(`https://chicomanda.com`), MySQL, VAPID, Google and Mailjet variables; App Sleeping off on both services; the
healthcheck path comes from `railway.json` on the next deploy; DB schema unchanged since the morning dump (no
`schema_migrations` yet: the baseline will be recorded), data fine for `002`/`003` (max price 1349, one float-noise
price). **Production and staging `SECRET` was `pippopluto`, the dev value public in `docker-compose.yml`**: rotated on
staging; on production rotate it on the release day (everybody logs in again). Staging App Sleeping turned off through
the GraphQL API (`environment edit --service-config ... deploy.sleepApplication false` answers "No changes to apply":
`new-client` now uses the API too). The invitation fix (`97e0bbb`, other session) and Node 22 / Sentry 11 (`724bc5e`)
are on main.

**All points done (3 October 2026).** Open items: production release (prices `DECIMAL` via `003`, settings `004`,
healthcheck, Sentry) whenever the user decides, after confirming `SECRET`/`BASE_URL` on the production service; first
real run of `new-client`.

---

## Original request (verbatim, in Italian)

> Voglio vendere l'app a più clienti. Ogni cliente avrà un'installazione separata: un suo progetto Railway con app e
> MySQL dedicati, raggiungibile su un sottodominio (es. libra.chicomanda.com), mentre chicomanda.com diventerà il sito
> vetrina, fuori da questo repo. Tutte le installazioni girano dallo stesso codice e dallo stesso branch: niente branch
> per cliente, le differenze tra clienti sono solo configurazione.
>
> Oggi c'è un solo cliente, Libra, in produzione su chicomanda.com (il passaggio al sottodominio lo farò io più avanti,
> a mano). Vincoli:
> - Non fare merge né push sul branch production e non lanciare npm run deploy-production: Libra è in servizio stasera
>   dalle 20. Stage è libero: puoi usarlo per provare.
> - Sul DB di produzione sono permesse solo letture (dump). Nessuna scrittura, nessuna migrazione, nessun ripristino.
> - Proponimi un piano prima di scrivere codice, poi un commit per punto, con test dove ha senso.
>
> **0) Backup e schema di produzione** (da fare subito, prima di tutto il resto)
> - Usa la Railway CLI (già autenticata; se non lo è fermati e chiedimelo) per ricavare le credenziali di connessione
>   pubblica del MySQL del progetto di produzione di Libra, senza stamparle nell'output e senza salvarle su file.
> - Fai due dump con mysqldump (se non è installato in locale, usa l'immagine docker mysql con la stessa versione major
>   del server): uno completo con --single-transaction --routines --triggers, e uno di sola struttura con --no-data.
> - Salvali fuori dal repo, in ~/backups/chi-comanda/ con la data nel nome (es. libra-2026-10-03-full.sql e
>   libra-2026-10-03-schema.sql). Non devono mai finire in git.
> - Verifica che il dump completo sia valido (dimensione, presenza delle tabelle principali, riga finale
>   "Dump completed") e dimmi l'esito.
> - Confronta il dump di struttura con init.sql e riportami le differenze: è lo schema reale da cui partono le migrazioni.
>
> **1) Migrazioni versionate e automatiche**
> - Cartella server/migrations con file numerati e tabella schema_migrations, applicate all'avvio del server prima di
>   accettare richieste, con un lock per evitare esecuzioni concorrenti.
> - La migrazione baseline deve corrispondere allo schema reale di produzione ricavato al punto 0, non a init.sql. Sui
>   DB esistenti la baseline non si esegue: viene solo registrata come applicata. Su un DB vuoto crea lo schema completo.
> - Le modifiche oggi in release.sql (notifiche push, v1.18) diventano la prima migrazione dopo la baseline.
> - Le migrazioni devono essere solo additive (aggiungere colonne e tabelle, niente rinomine o cancellazioni nella
>   stessa release), così la versione precedente dell'app continua a funzionare sullo schema nuovo e il rollback
>   consiste solo nel rimettere il deploy precedente.
> - Se una migrazione fallisce, il server non parte.
> - init.sql e release.sql vanno rimossi o generati dalle migrazioni; aggiorna docker-compose e il setup dei test di
>   conseguenza.
> - Test: DB vuoto → schema completo; DB con lo schema di produzione → solo le migrazioni nuove; seconda esecuzione →
>   nessun effetto.
> - Prova finale su stage: ripristina nel DB di stage il dump completo di produzione, rilascia su stage e verifica che le
>   migrazioni passino e che l'app funzioni.
>
> **2) Configurazione per installazione**
> - Variabili d'ambiente per identità e funzioni attive: CLIENT_NAME, CLIENT_SLUG, FEATURES (elenco separato da virgole).
> - Tabella settings per ciò che l'admin cambia da interfaccia: nome del locale, logo, colori del tema.
> - Endpoint pubblico /api/public/config che il client legge all'avvio per branding e funzioni attive.
> - Un modulo features lato server e un composable lato client per chiedere "questa funzione è attiva?". Le schermate e
>   le route delle funzioni spente non devono comparire né rispondere.
> - Le personalizzazioni per un singolo cliente si fanno sempre come funzione generale accesa da configurazione, mai con
>   codice condizionato sul nome del cliente.
> - Con la configurazione di default Libra deve comportarsi esattamente come oggi.
>
> **3) Salute e monitoraggio**
> - Endpoint /api/health con DB raggiungibile, versione dell'app e ultima migrazione applicata, adatto come healthcheck
>   path su Railway (Railway sposta il traffico sulla nuova versione solo quando risponde).
> - Sentry opzionale (server e client), attivo solo se è presente la variabile d'ambiente, con il tag del cliente.
>
> **4) Sessione e configurazione sicure**
> - Cookie di sessione legato al singolo host (nessun domain condiviso tra sottodomini), httpOnly, sameSite lax, secure
>   in produzione dietro proxy (trust proxy).
> - In produzione l'avvio fallisce se mancano SECRET o BASE_URL.
>
> **5) Script scripts/new-client <slug> per creare un nuovo cliente**
> - Con la Railway CLI: progetto, MySQL, servizio collegato al repo e al branch production, variabili d'ambiente (SECRET
>   casuale, chiavi VAPID generate, BASE_URL, CLIENT_NAME/SLUG, FEATURES), dominio custom <slug>.chicomanda.com,
>   healthcheck path /api/health.
> - DNS su Cloudflare: legge CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID dall'ambiente (mai dal repo) e si ferma con un
>   messaggio chiaro se mancano. Legge i record che Railway richiede per il dominio custom (CNAME ed eventuale TXT di
>   verifica) e li crea via API Cloudflare (POST /zones/{zone_id}/dns_records) con proxied=false.
> - Idempotente: se un record o una risorsa Railway esiste già con lo stesso valore non fa nulla; se esiste con un valore
>   diverso si ferma e chiede conferma invece di sovrascrivere.
> - Attende con timeout che https://<slug>.chicomanda.com/api/health risponda.
> - Crea il primo superuser e stampa il link per impostare la password.
> - Alla fine stampa un riepilogo con i passi manuali rimasti, in particolare il redirect URI da aggiungere su Google
>   Cloud: https://<slug>.chicomanda.com/api/auth/google/callback.
> - Opzione --dry-run che mostra cosa farebbe senza toccare né Railway né Cloudflare.
>
> **6) Rilasci e documentazione**
> - Tutte le installazioni dei clienti seguono il branch production; stage è il mio ambiente di prova.
> - Uno script di backup (scripts/backup-client <slug>) che riusa la procedura del punto 0.
> - Scrivi un README di deploy:
>   - come creare un cliente e come rilasciare;
>   - procedura di rilascio di una versione con migrazioni: backup del DB, prova su stage con una copia del DB di
>     produzione, rilascio in un giorno di chiusura, rollback rimettendo il deploy precedente;
>   - come fare e ripristinare i backup del DB di un cliente;
>   - come spostare un cliente esistente da un dominio a un altro (sessioni, notifiche push e login Google da rifare,
>     redirect 301 dal vecchio dominio).

**Note on the constraints**: on 3 October the user explicitly asked, as an exception, to align production with staging
(additive DB migration, VAPID keys, `deploy-production`), which was done. For the multi-client work the original
constraints apply again: no writes to the production DB and no production deploy without an explicit request.
