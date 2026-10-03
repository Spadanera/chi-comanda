# Backlog tecnico — Chi Comanda

Attività in ordine di priorità, emerse da una revisione della codebase (v1.17.0, ottobre 2026).
Ogni attività è pensata per essere un commit (o una PR) a sé, con test d'integrazione in `server/test/`.

Convenzioni già in uso da rispettare: servizi in `server/src/services`, errori tipizzati da `server/src/http/errors`,
validazione con `server/src/http/validate`, migrazioni numerate in `server/migrations/` (vedi README, "Database migrations").

---

## P0 — Soldi: possono produrre conti sbagliati

### 1. Prezzi degli ordini calcolati dal server

**Problema.** `OrderService.create` (`server/src/services/order.ts`) salva `item.price`, `name`, `type`, `destination_id`
così come arrivano dal client. Un bug del client (o una richiesta manipolata) produce prezzi arbitrari.

**Da fare.** Dentro la transazione di `create`, per ogni item:
- **voce di menu** (`master_item_id` presente e non `setMinimum`): leggere `price`, `name`, `destination_id` e sotto-tipo
  da `master_items` (+ `sub_types`/`types`) e ignorare i valori del client. Errore 400 se il master item non esiste
  o non è disponibile.
- **consumo minimo** (`setMinimum = true`): prezzo = `events.minimumConsumptionPrice` dell'evento dell'ordine.
- **voce extra** a prezzo libero (oggi creata in `client/src/views/WaiterOrder.vue`, `addItem` con `extraItem`,
  senza master item reale): resta a prezzo del client, ma validare `price` (numero finito ≥ 0) e `name` non vuoto.
  Valutare di marcarla esplicitamente (es. campo `extra`) invece di dedurla.

Leggere i master item con una sola query `IN (...)`, non una per item.

**Test.** Ordine con prezzo manomesso → salvato col prezzo di listino; consumo minimo → prezzo dell'evento;
master item inesistente → 400.

### 2. Riconciliazione dei pagamenti elettronici lato server

**Problema.** Quando SumUp conferma `PAID`, sono `onPaymentSuccess` in `client/src/components/CheckoutOrder.vue`
(dopo un `setTimeout`) a chiamare `completeTable` / `paySelectedItem`. Se il tablet si chiude, cambia pagina o perde
la rete, la transazione risulta pagata ma il tavolo resta aperto. `payment_transactions.item_ids` è salvato ma
non viene mai usato.

**Da fare.**
- In `server/src/services/payment.ts`, un metodo privato `settle(transactionId)` chiamato nello stesso punto in cui
  lo stato passa da `PENDING` a `PAID` (sia `handlePosCallback` sia `checkTransactionStatus`). Usare
  `UPDATE ... WHERE status = 'PENDING'` come lock: solo chi aggiorna la riga esegue la chiusura (idempotenza).
- `settle`: se `item_ids` non è vuoto → `tableService.paySelectedItems`; altrimenti → `tableService.close`.
  Meglio salvare sulla transazione anche la modalità (`partial` / `full`) invece di dedurla da `item_ids`.
- Notificare via socket (`tablesChanged` + `paymentCompleted`) dopo la chiusura.
- Client: `onPaymentSuccess` non chiama più `completeTable`/`paySelectedItem`, si limita a ricaricare i tavoli.
- Valutare un controllo di coerenza: l'importo della transazione deve corrispondere al totale degli item
  (meno sconto, vedi punto 3), altrimenti rifiutare la creazione.

**Test.** Callback POS `success` → tavolo `CLOSED` e item pagati senza altre chiamate; callback ripetuto →
nessun effetto doppio; pagamento parziale → solo gli item indicati pagati.

### 3. Prezzi in `DECIMAL` invece di `DOUBLE`

**Problema.** `items.price`, `master_items.price`, `events.minimumConsumptionPrice` sono `DOUBLE`
(`payment_transactions.amount` è già `DECIMAL(10,2)`). Somme e sconti accumulano errori di arrotondamento.

**Migrazione:** `server/migrations/003_decimal_prices.sql`. **Da fare (codice):**
mysql2 restituisce i `DECIMAL` come stringhe: impostare `decimalNumbers: true` nel pool (`server/src/db/index.ts`)
oppure convertire esplicitamente, e verificare che il client riceva ancora numeri.
Lato client, gli sconti in `CheckoutOrder.vue` (`discounts`) usano `Math.round` sull'euro intero: decidere se è voluto.

---

## P1 — Sicurezza e correttezza

### 4. Ruoli aggiornati senza dover rifare il login

**Problema.** `passport.serializeUser` (`server/src/auth/passport.ts`) mette l'intero utente in sessione.
Se un superuser cambia i ruoli o disattiva un utente, l'utente mantiene i vecchi permessi fino al logout
(sessioni di 30 giorni).

**Da fare.** Serializzare solo l'`id`; in `deserializeUser` ricaricare utente + ruoli (una query, con `USER_ROLES_JSON`)
e rifiutare utenti non attivi. Verificare che anche `sessionUser` in `server/src/socket/index.ts` legga i ruoli
aggiornati (oggi legge `session.passport.user`). Valutare una piccola cache in memoria se il carico lo richiede.

**Test.** Rimuovere un ruolo a un utente loggato → la richiesta successiva riceve 403.

### 5. Validazione dei body nelle route rimaste "aperte"

Diverse route passano `req.body` direttamente al servizio: `PUT /items` (`itemService.update`),
`PUT /events/:id/tables/layout`, `POST/PUT /events`, `POST /payment/settings`, i router di catalogo.
Aggiungere funzioni `toXxx(req.body)` come `toPaymentRequest` in `routes/payments.ts`.
Priorità a `PUT /items`, che può marcare `paid` su qualsiasi item.

### 6. Cookie di sessione

In `server/src/app.ts`: `saveUninitialized: false` (oggi crea sessioni anche per visitatori anonimi),
cookie `httpOnly`, `sameSite: 'lax'`, `secure` in produzione (con `app.set('trust proxy', 1)` dietro il proxy).
In produzione l'avvio deve fallire se manca `SECRET` (oggi c'è solo un warning in `config.ts`).

---

## P2 — Schema del database

### 7. Vincoli e tipi

- Foreign key mancanti: `items` → `orders`/`tables`/`events`, `orders` → `tables`/`events`, `tables` → `events`,
  `user_role` → `users`/`roles`, `user_event`. Prima di aggiungerle, una query che controlli le righe orfane in produzione.
- Indici su `items.table_id`, `items.order_id`, `orders.event_id`, `tables.event_id` (usati in tutte le subquery JSON).
- Stati come `ENUM` o `CHECK` (`events.status`, `tables.status`, `payment_transactions.status`, ...).
- Rimuovere gli `UNIQUE` ridondanti sulle primary key.

### 8. Migrazioni versionate

**Fatto** (multi-client, punto 1): `server/migrations/NNN_*.sql` + `schema_migrations`, applicate all'avvio.
Era: sostituire il `release.sql` unico con file numerati (`migrations/001_....sql`) e una tabella `schema_migrations`
applicata all'avvio o con uno script `npm run migrate`. Tenere `init.sql` come snapshot generato o eliminarlo.

---

## P3 — Client

### 9. Spezzare `CheckoutOrder.vue` (621 righe)

Estrarre un composable `usePayment` (scelta del provider, creazione della transazione, polling, ascolto del socket)
e un componente per il dialog di pagamento. Si fa dopo il punto 2, che toglie già metà della logica.

### 10. Props tipizzate e niente `JSON.parse(JSON.stringify())`

`defineProps(['event', 'navigation', 'roomid'])` → `defineProps<{...}>()` in tutti i componenti.
`copy()` in `client/src/services/utils.ts` → `structuredClone`.

### 11. Test minimi del client

Vitest su `services/utils.ts` (`groupItems`, ordinamenti, totali) e, dopo il punto 9, su `usePayment`.

---

## P4 — Igiene del repo

- Riscrivere il README: nome del progetto, niente Grunt, link del repository corretti in `package.json`
  (oggi puntano a `gig-addicted`), come si deploya davvero.
- Tenere un solo target di deploy fra `buildspec.yml`/EB, `railway.json`, `Procfile`.
- Rimuovere `dummy.txt`.
- `SECRET` di `docker-compose.yml` da `.env` invece che in chiaro.

---

## Fuori dal refactor: decisioni di prodotto

Non sono attività di codice ma scelte da fare prima, se l'app deve diventare un prodotto per altri locali:
fiscalità (scontrino / RT), modalità offline durante la serata, stampa delle comande, più sedi.
