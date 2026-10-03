import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import bcrypt from 'bcrypt'
import { closeApp, loadApp, PASSWORD, rawConnection, resetDatabase } from './helpers'
import { listRoutes } from './routes'
import { VENUE_TABLES } from '../src/venue/db'
import request from 'supertest'

/**
 * Isolation between venues. A user holding every role of venue A (1) attacks venue B (2): for every route, with B's
 * ids in the path or in the body, the answer is 404 (B's data doesn't exist for them, it is not merely forbidden) and
 * none of B's rows changes. Lists never show B's data. A route missing from this file fails the coverage test.
 */

/** Every name of venue B carries this marker: it must never appear in an answer to the attacker. */
const SECRET = 'B-SECRET'

let app: any
let attacker: any
/** Ids of venue B's rows, and of a few rows of venue A to mix with them. */
const B: Record<string, number> = {}
const A: Record<string, number> = {}

async function sql(query: string, params: unknown[] = []): Promise<any> {
    const conn = await rawConnection()
    try {
        const [rows] = await conn.query(query, params)
        return rows
    } finally {
        await conn.end()
    }
}
const insert = async (query: string, params: unknown[] = []) => (await sql(query, params)).insertId as number

/** Every row of venue B, to check that nothing changed. */
async function snapshotOfB() {
    const snapshot: Record<string, unknown> = {}
    for (const table of VENUE_TABLES) {
        snapshot[table] = await sql(`SELECT * FROM \`${table}\` WHERE venue_id = 2 ORDER BY 1`)
    }
    snapshot.venue = await sql('SELECT * FROM venues WHERE id = 2')
    snapshot.staff = await sql('SELECT id, username, email, status FROM users WHERE id = ?', [B.user])
    return JSON.parse(JSON.stringify(snapshot))
}

async function createVenueB() {
    await sql(`INSERT INTO venues (id, name, primary_color, logo) VALUES (2, '${SECRET} venue', '#123456', ?)`, [Buffer.from('logo')])
    B.menu = await insert(`INSERT INTO menu (venue_id, name, status) VALUES (2, '${SECRET} menu', 'ACTIVE')`)
    B.destination = await insert(`INSERT INTO destinations (venue_id, name, status, minute_to_alert) VALUES (2, '${SECRET} bar', 'ACTIVE', 5)`)
    B.type = await insert(`INSERT INTO types (venue_id, name, icon) VALUES (2, '${SECRET} type', 'mdi-beer')`)
    B.subType = await insert(`INSERT INTO sub_types (venue_id, name, type_id, icon) VALUES (2, '${SECRET} sub', ?, 'mdi-beer')`, [B.type])
    B.masterItem = await insert(`
        INSERT INTO master_items (venue_id, name, price, destination_id, available, status, menu_id, sub_type_id)
        VALUES (2, '${SECRET} spritz', 5, ?, TRUE, 'ACTIVE', ?, ?)`, [B.destination, B.menu, B.subType])
    B.room = await insert(`INSERT INTO rooms (venue_id, name, width, height, status) VALUES (2, '${SECRET} room', 10, 8, 'ACTIVE')`)
    B.masterTable = await insert(`
        INSERT INTO master_tables (venue_id, name, default_seats, status, room_id, x, y, width, height, shape)
        VALUES (2, '${SECRET} t1', 4, 'ACTIVE', ?, 0, 0, 1, 1, 'rect')`, [B.room])
    B.event = await insert(`INSERT INTO events (venue_id, name, date, status, menu_id) VALUES (2, '${SECRET} event', '2026-10-03', 'ONGOING', ?)`, [B.menu])
    B.eventTable = await insert(`
        INSERT INTO master_tables_event (venue_id, master_table_id, name, default_seats, status, room_id, x, y, width, height, shape, event_id)
        VALUES (2, ?, '${SECRET} t1', 4, 'ACTIVE', ?, 0, 0, 1, 1, 'rect', ?)`, [B.masterTable, B.room, B.event])
    B.table = await insert(`INSERT INTO tables (venue_id, event_id, name, status) VALUES (2, ?, '${SECRET} table', 'ACTIVE')`, [B.event])
    await sql('INSERT INTO table_master_table (venue_id, table_id, master_table_id) VALUES (2, ?, ?)', [B.table, B.eventTable])
    B.order = await insert(`INSERT INTO orders (venue_id, event_id, table_id, order_date) VALUES (2, ?, ?, NOW())`, [B.event, B.table])
    B.item = await insert(`
        INSERT INTO items (venue_id, event_id, table_id, order_id, master_item_id, name, price, destination_id, done, paid)
        VALUES (2, ?, ?, ?, ?, '${SECRET} spritz', 5, ?, FALSE, FALSE)`, [B.event, B.table, B.order, B.masterItem, B.destination])
    await sql(`INSERT INTO payment_settings (venue_id, provider, enabled, config) VALUES (2, 'sumup_checkout', 1, '{"api_key": "${SECRET}"}')`)
    B.transaction = await insert(`
        INSERT INTO payment_transactions (venue_id, table_id, event_id, provider, external_id, checkout_reference, amount, status)
        VALUES (2, ?, ?, 'sumup_checkout', 'ext', 'ref', 5, 'PENDING')`, [B.table, B.event])
    B.user = await insert(`INSERT INTO users (email, username, status) VALUES ('staff-b@test.local', '${SECRET} staff', 'ACTIVE')`)
    await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'waiter'`, [B.user])
    await sql('INSERT INTO user_event (venue_id, user_id, event_id) VALUES (2, ?, ?)', [B.user, B.event])
}

/** A few rows of venue A, to build requests mixing them with B's. */
async function createVenueA() {
    A.menu = 1
    ;[{ id: A.destination }] = await sql('SELECT id FROM destinations WHERE venue_id = 1 ORDER BY id LIMIT 1')
    ;[{ id: A.subType, type_id: A.type }] = await sql('SELECT id, type_id FROM sub_types WHERE venue_id = 1 ORDER BY id LIMIT 1')
    ;[{ id: A.room }] = await sql(`SELECT id FROM rooms WHERE venue_id = 1 AND status = 'ACTIVE' ORDER BY id LIMIT 1`)
    A.event = await insert(`INSERT INTO events (venue_id, name, date, status, menu_id) VALUES (1, 'Serata A', '2026-10-03', 'ONGOING', 1)`)
    A.eventTable = await insert(`
        INSERT INTO master_tables_event (venue_id, name, default_seats, status, room_id, x, y, width, height, shape, event_id)
        VALUES (1, 'A1', 4, 'ACTIVE', ?, 0, 0, 1, 1, 'rect', ?)`, [A.room, A.event])
    A.table = await insert(`INSERT INTO tables (venue_id, event_id, name, status) VALUES (1, ?, 'Tavolo A', 'ACTIVE')`, [A.event])
}

/** The attacker: every role of venue A, nothing in venue B, not the platform's superuser. */
async function createAttacker() {
    const id = await insert(`INSERT INTO users (email, username, password, status) VALUES ('attacker@test.local', 'attacker', ?, 'ACTIVE')`,
        [await bcrypt.hash(PASSWORD, 4)])
    await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 1 FROM roles WHERE name IN ('admin', 'checkout', 'waiter', 'bartender')`, [id])
    attacker = request.agent(app)
    await attacker.post('/api/login').send({ email: 'attacker@test.local', password: PASSWORD }).expect(200)
}

interface Case {
    /** Route as `listRoutes` prints it. */
    route: string
    path: () => string
    body?: () => unknown
    /** 404 unless said otherwise. */
    status?: number
    /** Why the answer is not a 404. */
    because?: string
}

const product = () => ({ name: 'x', price: 1, available: true, status: 'ACTIVE' })

/** Requests naming B's rows, in the path or in the body. */
const ATTACKS: Case[] = [
    { route: 'PUT /session/venue', path: () => '/session/venue', body: () => ({ venueId: 2 }) },

    // Events
    { route: 'GET /events/:id/status/:status', path: () => `/events/${B.event}/status/ONGOING` },
    { route: 'POST /events/', path: () => '/events/', body: () => ({ name: 'x', date: '2026-10-03', menu_id: B.menu, users: [] }) },
    { route: 'POST /events/', path: () => '/events/', body: () => ({ name: 'x', date: '2026-10-03', menu_id: A.menu, users: [{ id: B.user }] }) },
    { route: 'PUT /events/', path: () => '/events/', body: () => ({ id: B.event, name: 'x', menu_id: A.menu, users: [] }) },
    { route: 'PUT /events/', path: () => '/events/', body: () => ({ id: A.event, name: 'x', menu_id: B.menu, users: [] }) },
    { route: 'PUT /events/setstatus/:id', path: () => `/events/setstatus/${B.event}`, body: () => ({ status: 'CLOSED' }) },
    { route: 'DELETE /events/:id', path: () => `/events/${B.event}` },

    // Tables of an event
    { route: 'GET /events/:id/tables/layout', path: () => `/events/${B.event}/tables/layout` },
    { route: 'PUT /events/:id/tables/layout', path: () => `/events/${B.event}/tables/layout`, body: () => ({ rooms: [], tables: [] }) },
    {
        route: 'PUT /events/:id/tables/layout', path: () => `/events/${A.event}/tables/layout`,
        body: () => ({ rooms: [{ id: A.room }], tables: [{ id: B.eventTable, room_id: A.room, master_table_name: 'x' }] }),
    },
    {
        route: 'PUT /events/:id/tables/layout', path: () => `/events/${A.event}/tables/layout`,
        body: () => ({ rooms: [{ id: A.room }], tables: [{ id: A.eventTable, room_id: A.room, table_id: B.table, master_table_name: 'x' }] }),
    },
    { route: 'GET /events/:id/tables/free', path: () => `/events/${B.event}/tables/free` },
    { route: 'POST /events/:id/tables/multiple', path: () => `/events/${B.event}/tables/multiple`, body: () => ['x'] },
    { route: 'GET /events/:id/tables', path: () => `/events/${B.event}/tables` },
    { route: 'POST /events/:eventid/tables/:tableid/discount/:discount', path: () => `/events/${B.event}/tables/${B.table}/discount/1` },
    { route: 'POST /events/:eventid/tables/:tableid/discount/:discount', path: () => `/events/${A.event}/tables/${B.table}/discount/1` },

    // Tables
    { route: 'PUT /tables/:id/change/:masterid', path: () => `/tables/${B.table}/change/${A.eventTable}` },
    { route: 'PUT /tables/:id/change/:masterid', path: () => `/tables/${A.table}/change/${B.eventTable}` },
    { route: 'GET /tables/:id', path: () => `/tables/${B.table}` },
    { route: 'PUT /tables/:id/payitems', path: () => `/tables/${B.table}/payitems`, body: () => [B.item] },
    { route: 'PUT /tables/:id/payitems', path: () => `/tables/${A.table}/payitems`, body: () => [B.item] },
    { route: 'PUT /tables/:id/complete', path: () => `/tables/${B.table}/complete` },

    // Orders and items
    { route: 'GET /orders/:eventid/:destinationsids', path: () => `/orders/${B.event}/[${B.destination}]` },
    {
        route: 'POST /orders/', path: () => '/orders/',
        body: () => ({ event_id: B.event, table_name: 'x', items: [{ master_item_id: B.masterItem }] }),
    },
    { route: 'POST /orders/', path: () => '/orders/', body: () => ({ event_id: A.event, table_id: B.table, items: [] }) },
    { route: 'POST /orders/', path: () => '/orders/', body: () => ({ event_id: A.event, table_name: 'x', master_table_id: B.eventTable, items: [] }) },
    {
        route: 'POST /orders/', path: () => '/orders/',
        body: () => ({ event_id: A.event, table_name: 'x', items: [{ master_item_id: B.masterItem }] }),
    },
    {
        route: 'POST /orders/', path: () => '/orders/',
        body: () => ({ event_id: A.event, table_name: 'x', items: [{ name: 'fuori menu', price: 1, destination_id: B.destination }] }),
    },
    { route: 'PUT /orders/:order_id/complete', path: () => `/orders/${B.order}/complete`, body: () => ({ item_ids: [] }) },
    { route: 'DELETE /items/:id', path: () => `/items/${B.item}` },
    { route: 'PUT /items/', path: () => '/items/', body: () => ({ id: B.item, done: true, paid: true }) },
    { route: 'PUT /items/open', path: () => '/items/open', body: () => ({ id: B.item, done: true, paid: false, table_id: B.table }) },

    // Catalogue
    { route: 'POST /menu/', path: () => '/menu/', body: () => ({ name: 'x', from_id: B.menu }) },
    { route: 'PUT /menu/', path: () => '/menu/', body: () => ({ id: B.menu, name: 'x' }) },
    { route: 'DELETE /menu/:id', path: () => `/menu/${B.menu}` },
    { route: 'PUT /destinations/', path: () => '/destinations/', body: () => ({ id: B.destination, name: 'x', status: 'ACTIVE', minute_to_alert: 1 }) },
    { route: 'GET /master-items/available/:id', path: () => `/master-items/available/${B.menu}` },
    { route: 'GET /master-items/:id', path: () => `/master-items/${B.menu}` },
    { route: 'POST /master-items/', path: () => '/master-items/', body: () => ({ ...product(), menu_id: B.menu, sub_type_id: A.subType, destination_id: A.destination }) },
    { route: 'POST /master-items/', path: () => '/master-items/', body: () => ({ ...product(), menu_id: A.menu, sub_type_id: B.subType, destination_id: A.destination }) },
    { route: 'POST /master-items/', path: () => '/master-items/', body: () => ({ ...product(), menu_id: A.menu, sub_type_id: A.subType, destination_id: B.destination }) },
    { route: 'PUT /master-items/', path: () => '/master-items/', body: () => ({ ...product(), id: B.masterItem, sub_type_id: A.subType, destination_id: A.destination }) },
    { route: 'PUT /types/', path: () => '/types/', body: () => ({ id: B.type, name: 'x', icon: 'x' }) },
    { route: 'DELETE /types/:id', path: () => `/types/${B.type}` },
    { route: 'POST /subtypes/', path: () => '/subtypes/', body: () => ({ name: 'x', type_id: B.type, icon: 'x' }) },
    { route: 'PUT /subtypes/', path: () => '/subtypes/', body: () => ({ id: B.subType, name: 'x', type_id: A.type, icon: 'x' }) },
    { route: 'PUT /subtypes/', path: () => '/subtypes/', body: () => ({ id: A.subType, name: 'x', type_id: B.type, icon: 'x' }) },
    { route: 'DELETE /subtypes/:id', path: () => `/subtypes/${B.subType}` },

    // Layout of the venue
    { route: 'PUT /master-tables/layout', path: () => '/master-tables/layout', body: () => ({ rooms: [{ id: B.room, name: 'x', width: 1, height: 1 }], tables: [] }) },
    {
        route: 'PUT /master-tables/layout', path: () => '/master-tables/layout',
        body: () => ({ rooms: [{ id: A.room, name: 'x', width: 1, height: 1 }], tables: [{ id: B.masterTable, room_id: A.room, name: 'x' }] }),
    },
    {
        route: 'GET /master-tables/:id', path: () => `/master-tables/${B.eventTable}`, status: 200,
        because: 'answers 0 for a missing table (the client relies on it), so the same for another venue\'s',
    },

    // Payments
    { route: 'GET /payment/checkout/:id/status', path: () => `/payment/checkout/${B.transaction}/status` },
    { route: 'POST /payment/checkout/sumup-checkout', path: () => '/payment/checkout/sumup-checkout', body: () => ({ table_id: B.table, event_id: B.event, amount: 1 }) },
    { route: 'POST /payment/checkout/sumup-pos', path: () => '/payment/checkout/sumup-pos', body: () => ({ table_id: B.table, event_id: B.event, amount: 1 }) },
    { route: 'POST /payment/checkout/sumup-solo', path: () => '/payment/checkout/sumup-solo', body: () => ({ table_id: B.table, event_id: B.event, amount: 1 }) },

    // Branding
    { route: 'GET /public/logo/:size.png', path: () => '/public/logo/512.png?venue=2&v=1' },
]

/** Lists and the venue's own resources: answered (200), never with B's data. */
const LISTS: Case[] = [
    { route: 'GET /checkauthentication', path: () => '/checkauthentication' },
    { route: 'GET /public/config', path: () => '/public/config' },
    { route: 'GET /public/manifest.webmanifest', path: () => '/public/manifest.webmanifest' },
    { route: 'GET /events/ongoing', path: () => '/events/ongoing' },
    { route: 'GET /events/users', path: () => '/events/users' },
    { route: 'GET /events/status/:status', path: () => '/events/status/ONGOING' },
    { route: 'GET /events/status/:status', path: () => '/events/status/CLOSED?page=1' },
    { route: 'GET /menu/', path: () => '/menu/' },
    { route: 'GET /destinations/', path: () => '/destinations/' },
    { route: 'POST /destinations/', path: () => '/destinations/', body: () => ({ name: 'Nuova', minute_to_alert: 5 }) },
    { route: 'GET /types/', path: () => '/types/' },
    { route: 'POST /types/', path: () => '/types/', body: () => ({ name: 'Nuovo', icon: 'mdi-beer' }) },
    { route: 'GET /subtypes/', path: () => '/subtypes/' },
    { route: 'GET /master-tables/layout', path: () => '/master-tables/layout' },
    { route: 'GET /payment/settings', path: () => '/payment/settings' },
    { route: 'POST /payment/settings', path: () => '/payment/settings', body: () => ({ provider: 'sumup_pos', enabled: false, config: {} }) },
    { route: 'GET /payment/available', path: () => '/payment/available' },
    { route: 'GET /settings/', path: () => '/settings/' },
    { route: 'PUT /settings/', path: () => '/settings/', body: () => ({ venue_name: 'Venue A' }) },
    { route: 'DELETE /settings/logo', path: () => '/settings/logo' },
]

/** Routes outside any venue's data, and why. */
const EXEMPT: Record<string, string> = {
    'POST /login': 'authentication',
    'POST /logout': 'authentication',
    'GET /auth/google': 'authentication (installation level)',
    'GET /auth/google/callback': 'authentication (installation level)',
    'POST /public/invitation/accept': 'authenticated by the invitation token (accounts-payments.test.ts)',
    'POST /public/askreset': 'account level, answers the same for every e-mail',
    'POST /public/reset': 'authenticated by the reset token (accounts-payments.test.ts)',
    'GET /public/payment/sumup/pos-callback': 'authenticated by the signature, works in the venue of the transaction (accounts-payments.test.ts)',
    'GET /users-public/avatar/:id': 'avatars of accounts, shared by every venue',
    'PUT /profile/avatar/:id': 'the own account only (ownProfileOnly)',
    'PUT /profile/username': 'the own account only',
    'GET /push/config': 'installation keys',
    'GET /push/preference': 'the own account only',
    'PUT /push/preference': 'the own account only',
    'POST /push/subscriptions': 'the own devices only',
    'DELETE /push/subscriptions': 'the own devices only',
    'POST /broadcast/': 'sent to the rooms of the own venue (socket.test.ts)',
    'PUT /settings/logo': 'the own venue only (session-venue.test.ts); needs an upload',
}

/** Routes of the platform's superuser: a user of a venue is refused whatever the id. */
const SUPERUSER_ONLY = [
    'GET /platform/venues', 'POST /platform/venues', 'PUT /platform/venues/:id', 'GET /platform/users',
    'PUT /platform/users/:id/status', 'PUT /platform/users/:id/superuser', 'DELETE /platform/users/:id',
    'GET /audit/', 'GET /users/', 'PUT /users/', 'DELETE /users/:id', 'PUT /users/roles', 'POST /users/invite',
]

function call(c: Case) {
    const method = c.route.split(' ')[0].toLowerCase() as 'get' | 'post' | 'put' | 'delete'
    const req = attacker[method](`/api${c.path()}`)
    return c.body ? req.send(c.body() as object) : req
}

let before: unknown

beforeAll(async () => {
    await resetDatabase()
    app = await loadApp()
    await createVenueB()
    await createVenueA()
    await createAttacker()
    before = await snapshotOfB()
})

afterAll(async () => {
    await resetDatabase()
    await closeApp()
})

describe('isolation between venues', () => {
    it('covers every route of the api', async () => {
        const { default: apiRouter } = await import('../src/routes')
        const covered = new Set([...ATTACKS, ...LISTS].map(c => c.route).concat(Object.keys(EXEMPT), SUPERUSER_ONLY))
        expect(listRoutes(apiRouter).filter(route => !covered.has(route))).toEqual([])
    })

    // Ids exist only after beforeAll: the names show the route and the position of the case
    it.each(ATTACKS.map((c, i) => [`${c.route} (#${i + 1})`, c] as const))('answers %s as missing', async (_name, c) => {
        const res = await call(c)
        expect(res.status, JSON.stringify(res.body)).toBe(c.status ?? 404)
        expect(JSON.stringify(res.body ?? '')).not.toContain(SECRET)
        if (c.route === 'GET /master-tables/:id') expect(res.body).toBe(0)
    })

    it.each(LISTS.map((c, i) => [`${c.route} (#${i + 1})`, c] as const))('shows nothing of B in %s', async (_name, c) => {
        const res = await call(c)
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        expect(res.text).not.toContain(SECRET)
    })

    it('refuses the platform to a venue user', async () => {
        for (const route of SUPERUSER_ONLY) {
            const [method, path] = route.split(' ')
            const res = await attacker[method.toLowerCase()](`/api${path.replace(':id', String(B.user))}`).send({})
            expect(res.status, route).toBe(403)
        }
    })

    it('leaves every row of B as it was', async () => {
        expect(await snapshotOfB()).toEqual(before)
    })

    it('shows no payment provider of B', async () => {
        expect((await attacker.get('/api/payment/available')).body).toEqual([])
    })
})
