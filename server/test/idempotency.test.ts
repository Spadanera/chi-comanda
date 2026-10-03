import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { closeApp, loadApp, loginAs, openEvent, openTable, rawConnection, resetDatabase, RoleName } from './helpers'
import { notify } from '../src/socket'

/** `Idempotency-Key`: a request sent twice (a retry on an unstable network) is executed once. */

let app: any
let ids: Record<RoleName, number>
let eventId: number
let waiter: any
let checkout: any
let menu: { id: number }[]

async function query(sql: string, params: unknown[] = []): Promise<any[]> {
    const conn = await rawConnection()
    try {
        const [rows]: any = await conn.query(sql, params)
        return rows
    } finally {
        await conn.end()
    }
}

const orderBody = (name = `Tavolo ${randomUUID()}`) => ({
    event_id: eventId, table_name: name, items: [{ master_item_id: menu[0].id, done: false, paid: false }],
})
const ordersOf = async (tableName: string) =>
    (await query('SELECT orders.id FROM orders JOIN tables ON tables.id = orders.table_id WHERE tables.name = ?', [tableName])).length

beforeAll(async () => {
    ids = await resetDatabase()
    app = await loadApp()
    eventId = await openEvent(app, ids)
    waiter = await loginAs(app, 'waiter')
    checkout = await loginAs(app, 'checkout')
    menu = (await waiter.get('/api/master-items/available/1')).body
})

afterEach(() => { vi.restoreAllMocks() })

afterAll(closeApp)

describe('orders', () => {
    it('places the order once and answers the retry with the stored answer', async () => {
        const key = randomUUID()
        const body = orderBody()
        const newOrder = vi.spyOn(notify, 'newOrder')

        const first = await waiter.post('/api/orders').set('Idempotency-Key', key).send(body).expect(200)
        const retry = await waiter.post('/api/orders').set('Idempotency-Key', key).send(body).expect(200)

        expect(retry.body).toBe(first.body)
        expect(first.headers['idempotent-replayed']).toBeUndefined()
        expect(retry.headers['idempotent-replayed']).toBe('true')
        expect(await ordersOf(body.table_name)).toBe(1)
        // Real-time notifications only for the real one
        expect(newOrder).toHaveBeenCalledTimes(1)
    })

    it('places the order once when the two requests arrive together', async () => {
        const key = randomUUID()
        const body = orderBody()
        const answers = await Promise.all([1, 2, 3].map(() => waiter.post('/api/orders').set('Idempotency-Key', key).send(body)))

        expect(answers.map(a => a.status)).toEqual([200, 200, 200])
        expect(new Set(answers.map(a => a.body)).size).toBe(1)
        expect(answers.filter(a => a.headers['idempotent-replayed'] === 'true')).toHaveLength(2)
        expect(await ordersOf(body.table_name)).toBe(1)
    })

    it('frees the key when the operation fails, so the corrected request runs', async () => {
        const key = randomUUID()
        const failed = await waiter.post('/api/orders').set('Idempotency-Key', key)
            .send({ ...orderBody(), items: [{ master_item_id: 999999, done: false, paid: false }] })
        expect(failed.status).toBeGreaterThanOrEqual(400)

        const body = orderBody()
        await waiter.post('/api/orders').set('Idempotency-Key', key).send(body).expect(200)
        expect(await ordersOf(body.table_name)).toBe(1)
    })

    it('refuses the key for another request, or for somebody else, without telling what it was', async () => {
        const key = randomUUID()
        const body = orderBody()
        await waiter.post('/api/orders').set('Idempotency-Key', key).send(body).expect(200)

        const other = await waiter.post('/api/orders').set('Idempotency-Key', key).send(orderBody())
        expect(other.status).toBe(422)
        const stolen = await checkout.post('/api/orders').set('Idempotency-Key', key).send(body)
        expect(stolen.status).toBe(422)
        expect(JSON.stringify(stolen.body)).not.toContain(body.table_name)
        expect(await ordersOf(body.table_name)).toBe(1)
    })

    it('refuses a key that is not a UUID', async () => {
        const res = await waiter.post('/api/orders').set('Idempotency-Key', 'not-a-uuid').send(orderBody())
        expect(res.status).toBe(400)
    })

    it('works as before without the header', async () => {
        const body = orderBody()
        await waiter.post('/api/orders').send(body).expect(200)
        await waiter.post('/api/orders').send({ ...body, table_id: undefined }).expect(200)
        expect((await query('SELECT id FROM tables WHERE name = ?', [body.table_name])).length).toBe(2)
    })

    it('forgets keys after 30 days', async () => {
        const old = randomUUID()
        await query(`INSERT INTO idempotency_keys (venue_id, idem_key, scope, request_hash, response_status, created_at)
            VALUES (1, ?, 'POST /orders', 'x', 200, NOW() - INTERVAL 31 DAY)`, [old])
        await waiter.post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody()).expect(200)
        await vi.waitFor(async () => expect(await query('SELECT id FROM idempotency_keys WHERE idem_key = ?', [old])).toHaveLength(0))
    })
})

describe('checkout', () => {
    it('closes a table once', async () => {
        const { tableId } = await openTable(app, eventId)
        const tablesChanged = vi.spyOn(notify, 'tablesChanged')
        const key = randomUUID()
        const first = await checkout.put(`/api/tables/${tableId}/complete`).set('Idempotency-Key', key).expect(200)
        const retry = await checkout.put(`/api/tables/${tableId}/complete`).set('Idempotency-Key', key).expect(200)
        expect(retry.body).toEqual(first.body)
        expect(retry.headers['idempotent-replayed']).toBe('true')
        expect(tablesChanged).toHaveBeenCalledTimes(1)
    })

    it('pays the items once; the same key on another table is refused', async () => {
        const { tableId, items } = await openTable(app, eventId)
        const other = await openTable(app, eventId)
        const key = randomUUID()
        await checkout.put(`/api/tables/${tableId}/payitems`).set('Idempotency-Key', key).send([items[0].id]).expect(200)
        await checkout.put(`/api/tables/${tableId}/payitems`).set('Idempotency-Key', key).send([items[0].id]).expect(200)
        expect((await checkout.put(`/api/tables/${other.tableId}/payitems`).set('Idempotency-Key', key).send([other.items[0].id])).status)
            .toBe(422)
        expect((await query('SELECT paid FROM items WHERE table_id = ?', [other.tableId])).every(i => !i.paid)).toBe(true)
    })

    it('creates one payment transaction per key', async () => {
        const admin = await loginAs(app, 'admin')
        await admin.post('/api/payment/settings').send({
            provider: 'sumup_pos', enabled: true, config: { affiliate_key: 'aff', server_url: 'https://example.test' },
        }).expect(200)
        await admin.post('/api/payment/settings').send({ provider: 'sumup_checkout', enabled: true, config: { api_key: 'key' } }).expect(200)
        const table = await openTable(app, eventId)
        const body = { event_id: eventId, table_id: table.tableId, amount: table.total, item_ids: [] }

        const key = randomUUID()
        const [first, second] = await Promise.all([1, 2].map(() =>
            checkout.post('/api/payment/checkout/sumup-pos').set('Idempotency-Key', key).send(body)))
        expect(first.status).toBe(200)
        expect(second.body).toEqual(first.body)

        // The provider is asked once too
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
            new Response(JSON.stringify({ id: 'chk_1' }), { status: 200 }))
        const linkKey = randomUUID()
        await checkout.post('/api/payment/checkout/sumup-checkout').set('Idempotency-Key', linkKey).send(body).expect(200)
        await checkout.post('/api/payment/checkout/sumup-checkout').set('Idempotency-Key', linkKey).send(body).expect(200)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect((await query('SELECT id FROM payment_transactions WHERE table_id = ?', [table.tableId])).length).toBe(2)
    })
})

describe('venues', () => {
    /** Venue 2 with its own menu and ongoing event; the waiter works in both venues. */
    async function createVenue2() {
        await query(`INSERT INTO venues (id, name) VALUES (2, 'Secondo')`)
        const insert = async (sql: string, params: unknown[] = []) => (await query(sql, params) as any).insertId as number
        const menuId = await insert(`INSERT INTO menu (venue_id, name, status) VALUES (2, 'Menu 2', 'ACTIVE')`)
        const destination = await insert(`INSERT INTO destinations (venue_id, name, status, minute_to_alert) VALUES (2, 'Bar 2', 'ACTIVE', 5)`)
        const type = await insert(`INSERT INTO types (venue_id, name, icon) VALUES (2, 'Bere', 'mdi-beer')`)
        const subType = await insert(`INSERT INTO sub_types (venue_id, name, type_id, icon) VALUES (2, 'Birre', ?, 'mdi-beer')`, [type])
        const item = await insert(`
            INSERT INTO master_items (venue_id, name, price, destination_id, available, status, menu_id, sub_type_id)
            VALUES (2, 'Birra', 5, ?, TRUE, 'ACTIVE', ?, ?)`, [destination, menuId, subType])
        const event = await insert(`INSERT INTO events (venue_id, name, date, status, menu_id) VALUES (2, 'Serata 2', '2026-10-03', 'ONGOING', ?)`, [menuId])
        await query(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'waiter'`, [ids.waiter])
        return { event, item }
    }

    it('keeps the same key of two venues apart', async () => {
        const venue2 = await createVenue2()
        const key = randomUUID()
        const both = await loginAs(app, 'waiter')

        await both.put('/api/session/venue').send({ venueId: 1 }).expect(200)
        const inVenue1 = orderBody()
        const first = await both.post('/api/orders').set('Idempotency-Key', key).send(inVenue1).expect(200)

        await both.put('/api/session/venue').send({ venueId: 2 }).expect(200)
        const inVenue2 = { event_id: venue2.event, table_name: 'Tavolo V2', items: [{ master_item_id: venue2.item, done: false, paid: false }] }
        const second = await both.post('/api/orders').set('Idempotency-Key', key).send(inVenue2).expect(200)

        // Executed in venue 2, not answered with venue 1's table
        expect(second.headers['idempotent-replayed']).toBeUndefined()
        expect(second.body).not.toBe(first.body)
        expect((await query('SELECT venue_id FROM tables WHERE id = ?', [second.body]))[0].venue_id).toBe(2)
        expect((await query('SELECT venue_id FROM idempotency_keys WHERE idem_key = ? ORDER BY venue_id', [key])).map(r => r.venue_id))
            .toEqual([1, 2])

        // Venue 1's request replayed in venue 2 is not venue 1's answer: venue 1's event is not there
        const replayed = await both.post('/api/orders').set('Idempotency-Key', key).send(inVenue1)
        expect(replayed.status).toBe(422)
        expect(JSON.stringify(replayed.body)).not.toContain(String(first.body))
    })
})
