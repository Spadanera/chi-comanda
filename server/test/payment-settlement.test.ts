import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { closeApp, loadApp, loginAs, openEvent, openTable, rawConnection, resetDatabase, RoleName } from './helpers'

let app: any
let users: Record<RoleName, number>
let eventId: number
let checkout: any

async function query(sql: string, params: unknown[] = []) {
    const conn = await rawConnection()
    try {
        const [rows]: any = await conn.query(sql, params)
        return rows
    } finally {
        await conn.end()
    }
}

/** Table status, items (id, price, paid) and discount items. */
async function tableState(tableId: number) {
    const [table] = await query('SELECT status, paid FROM tables WHERE id = ?', [tableId])
    const items = await query(`SELECT id, price, paid, type FROM items WHERE table_id = ? ORDER BY id`, [tableId])
    return {
        status: table.status,
        paid: items.filter((i: any) => i.type !== 'Sconto').map((i: any) => !!i.paid),
        discounts: items.filter((i: any) => i.type === 'Sconto').map((i: any) => Number(i.price)),
    }
}

/** Creates a POS transaction and returns its id and the signed callback query. */
async function posSession(body: object) {
    const res = await checkout.post('/api/payment/checkout/sumup-pos').send({ event_id: eventId, ...body })
    if (res.status !== 200) return { status: res.status, message: res.body.message } as any
    const callback = new URL(decodeURIComponent(res.body.url_scheme.match(/callback=([^&]+)/)[1]))
    return { status: 200, id: res.body.id, query: Object.fromEntries(callback.searchParams), item_ids: res.body.item_ids }
}

const posCallback = (query: Record<string, string>, status = 'success') =>
    request(app).get('/api/public/payment/sumup/pos-callback').query({ ...query, 'smp-status': status, 'smp-tx-code': 'TX' })

beforeAll(async () => {
    users = await resetDatabase()
    app = await loadApp()
    const admin = await loginAs(app, 'admin')
    await admin.post('/api/payment/settings').send({
        provider: 'sumup_pos', enabled: true, config: { affiliate_key: 'aff', server_url: 'https://example.test' },
    }).expect(200)
    await admin.post('/api/payment/settings').send({ provider: 'sumup_checkout', enabled: true, config: { api_key: 'key' } }).expect(200)
    eventId = await openEvent(app, users)
    checkout = await loginAs(app, 'checkout')
})

afterEach(() => { vi.restoreAllMocks() })

afterAll(closeApp)

describe('a confirmed electronic payment is settled by the server', () => {
    it('closes the table on the POS callback, with no call from the tablet', async () => {
        const table = await openTable(app, eventId)
        const tx = await posSession({ table_id: table.tableId, amount: table.total, item_ids: [] })
        expect(tx.item_ids).toEqual(table.items.map(i => i.id))

        await posCallback(tx.query).expect(200)
        expect(await tableState(table.tableId)).toEqual({ status: 'CLOSED', paid: [true, true], discounts: [] })
        expect((await query('SELECT status, mode FROM payment_transactions WHERE id = ?', [tx.id]))[0]).toEqual({ status: 'PAID', mode: 'full' })
    })

    it('ignores a repeated callback', async () => {
        const table = await openTable(app, eventId)
        const tx = await posSession({ table_id: table.tableId, amount: table.total - 1, item_ids: [] })
        await posCallback(tx.query).expect(200)
        await posCallback(tx.query).expect(200)
        expect((await tableState(table.tableId)).discounts).toEqual([-1])
    })

    it('records a lower amount as a discount', async () => {
        const table = await openTable(app, eventId)
        const tx = await posSession({ table_id: table.tableId, amount: table.total - 2.5, item_ids: [] })
        await posCallback(tx.query).expect(200)
        expect(await tableState(table.tableId)).toEqual({ status: 'CLOSED', paid: [true, true], discounts: [-2.5] })
    })

    it('pays only the chosen items for a partial payment', async () => {
        const table = await openTable(app, eventId, 3)
        const [first, second] = table.items
        const tx = await posSession({ table_id: table.tableId, amount: Number(first.price) + Number(second.price), item_ids: [first.id, second.id] })
        await posCallback(tx.query).expect(200)
        expect(await tableState(table.tableId)).toEqual({ status: 'ACTIVE', paid: [true, true, false], discounts: [] })
        expect((await query('SELECT mode FROM payment_transactions WHERE id = ?', [tx.id]))[0].mode).toBe('partial')
    })

    it('leaves the table open for items ordered while the customer was paying', async () => {
        const table = await openTable(app, eventId)
        const tx = await posSession({ table_id: table.tableId, amount: table.total, item_ids: [] })
        const menu = (await table.waiter.get('/api/master-items/available/1')).body
        await table.waiter.post('/api/orders').send({ event_id: eventId, table_id: table.tableId, items: [{ master_item_id: menu[0].id }] }).expect(200)

        await posCallback(tx.query).expect(200)
        expect(await tableState(table.tableId)).toEqual({ status: 'ACTIVE', paid: [true, true, false], discounts: [] })
    })

    it('touches nothing when the payment fails', async () => {
        const table = await openTable(app, eventId)
        const tx = await posSession({ table_id: table.tableId, amount: table.total, item_ids: [] })
        await posCallback(tx.query, 'failed').expect(200)
        expect(await tableState(table.tableId)).toEqual({ status: 'ACTIVE', paid: [false, false], discounts: [] })
        expect((await query('SELECT status FROM payment_transactions WHERE id = ?', [tx.id]))[0].status).toBe('FAILED')
    })

    it('settles once when status polling finds the checkout paid, even with parallel polls', async () => {
        const table = await openTable(app, eventId)
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init?: any) =>
            new Response(JSON.stringify(init?.method === 'POST' ? { id: 'chk_1' } : { status: 'PAID' }), { status: 200 }))

        const created = await checkout.post('/api/payment/checkout/sumup-checkout').send({
            event_id: eventId, table_id: table.tableId, amount: table.total - 1, item_ids: [],
        }).expect(200)
        const polls = await Promise.all([1, 2, 3].map(() => checkout.get(`/api/payment/checkout/${created.body.id}/status`)))
        expect(polls.map(p => p.body.status)).toEqual(['PAID', 'PAID', 'PAID'])
        expect(fetchMock).toHaveBeenCalled()
        expect(await tableState(table.tableId)).toEqual({ status: 'CLOSED', paid: [true, true], discounts: [-1] })
    })
})

describe('payments are checked when created', () => {
    it('refuses an amount above the total to pay', async () => {
        const table = await openTable(app, eventId)
        const res = await posSession({ table_id: table.tableId, amount: table.total + 1, item_ids: [] })
        expect(res.status).toBe(400)
        expect(res.message).toBe(`L'importo supera il totale da pagare (${table.total.toFixed(2)} €)`)
    })

    it('refuses items of another table or already paid', async () => {
        const table = await openTable(app, eventId)
        const other = await openTable(app, eventId)
        expect((await posSession({ table_id: table.tableId, amount: 1, item_ids: [other.items[0].id] })).status).toBe(400)

        await checkout.put(`/api/tables/${table.tableId}/payitems`).send([table.items[0].id]).expect(200)
        expect((await posSession({ table_id: table.tableId, amount: 1, item_ids: [table.items[0].id] })).status).toBe(400)
    })

    it('refuses a closed table or one with nothing to pay', async () => {
        const table = await openTable(app, eventId)
        await checkout.put(`/api/tables/${table.tableId}/complete`).expect(200)
        expect((await posSession({ table_id: table.tableId, amount: 1, item_ids: [] })).status).toBe(400)
    })
})
