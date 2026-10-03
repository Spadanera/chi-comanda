import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeApp, loadApp, loginAs, rawConnection, resetDatabase, RoleName } from './helpers'

let app: any
let users: Record<RoleName, number>
let waiter: any
let eventId: number
let beer: any
let cocktail: any

async function query(sql: string, params: unknown[] = []) {
    const conn = await rawConnection()
    try {
        const [rows]: any = await conn.query(sql, params)
        return rows
    } finally {
        await conn.end()
    }
}

/** Places an order on a new table and returns the stored items (in insertion order). */
async function order(items: object[]) {
    const res = await waiter.post('/api/orders').send({ event_id: eventId, table_name: 'Prezzi', items })
    if (res.status !== 200) return { status: res.status, message: res.body.message, items: [] }
    const stored = await query(`
        SELECT items.name, items.price, items.destination_id, items.setMinimum, items.sub_type, items.sub_type_id, items.note
        FROM items INNER JOIN orders ON orders.id = items.order_id
        WHERE orders.table_id = ? ORDER BY items.id`, [res.body])
    return { status: res.status, items: stored }
}

const fromMenu = (entry: any, overrides: object = {}) => ({
    master_item_id: entry.id, name: entry.name, price: entry.price, destination_id: entry.destination_id,
    type: entry.type, sub_type: entry.sub_type, icon: entry.icon, done: false, paid: false, ...overrides,
})

beforeAll(async () => {
    users = await resetDatabase()
    await query(`UPDATE master_items SET available = TRUE WHERE menu_id = 1`)
    app = await loadApp()
    const admin = await loginAs(app, 'admin')
    eventId = (await admin.post('/api/events').send({
        name: 'Serata prezzi', date: '2026-10-02', menu_id: 1, minimumConsumptionPrice: 5, users: [{ id: users.waiter }],
    }).expect(200)).body
    await admin.put(`/api/events/setstatus/${eventId}`).send({ status: 'ONGOING' }).expect(200)

    waiter = await loginAs(app, 'waiter')
    const menu = (await waiter.get('/api/master-items/available/1').expect(200)).body
    beer = menu.find((i: any) => i.sub_type !== 'Cocktail')
    cocktail = menu.find((i: any) => i.sub_type === 'Cocktail')
})

afterAll(closeApp)

describe('order prices are decided by the server', () => {
    it('uses the menu price, name and destination, ignoring the client', async () => {
        const res = await order([fromMenu(beer, { price: 0.01, name: 'Birra gratis', destination_id: 2, sub_type: 'Altro', note: 'senza schiuma' })])
        expect(res.status).toBe(200)
        expect(res.items).toEqual([expect.objectContaining({
            name: beer.name, price: beer.price, destination_id: beer.destination_id,
            sub_type: beer.sub_type, sub_type_id: String(beer.sub_type_id), note: 'senza schiuma',
        })])
    })

    it('charges the event minimum consumption for setMinimum items', async () => {
        const res = await order([fromMenu(beer, { setMinimum: true, price: 0 })])
        expect(res.items).toEqual([expect.objectContaining({ name: beer.name, price: 5, setMinimum: 1 })])
    })

    it('charges the premium price for PREMIUM cocktails', async () => {
        const res = await order([fromMenu(cocktail, { premium: true, price: 1 })])
        expect(res.items).toEqual([expect.objectContaining({ name: `${cocktail.name} - PREMIUM`, price: 9 })])
    })

    it('keeps the waiter price for off-menu items, validated', async () => {
        const res = await order([{ name: '  Torta di compleanno ', price: 3.5, destination_id: 2, sub_type: 'Fuori Menu' }])
        expect(res.items).toEqual([expect.objectContaining({ name: 'Torta di compleanno', price: 3.5, destination_id: 2, sub_type: 'Fuori Menu' })])

        expect((await order([{ name: 'Sconto furbo', price: -10, destination_id: 1 }])).status).toBe(400)
        expect((await order([{ name: 'Senza prezzo', destination_id: 1 }])).status).toBe(400)
        expect((await order([{ name: '   ', price: 2, destination_id: 1 }])).status).toBe(400)
        // An id that is not the venue's is missing, as another venue's would be
        expect((await order([{ name: 'Destinazione inventata', price: 2, destination_id: 999 }])).status).toBe(404)
    })

    it('rejects unknown, unavailable or other-menu products without creating anything', async () => {
        const [{ tables: before }] = await query('SELECT COUNT(*) tables FROM tables')

        const unknown = await order([fromMenu(beer), fromMenu({ ...beer, id: 999999 })])
        expect(unknown.status).toBe(404)

        await query('UPDATE master_items SET available = FALSE WHERE id = ?', [cocktail.id])
        const unavailable = await order([fromMenu(cocktail)])
        expect(unavailable.status).toBe(400)
        expect(unavailable.message).toBe(`«${cocktail.name}» non è più disponibile`)
        await query('UPDATE master_items SET available = TRUE WHERE id = ?', [cocktail.id])

        const [menu2] = await Promise.all([query(`INSERT INTO menu (name, creation_date, status) VALUES ('Altro menu', NOW(), 'ACTIVE')`)])
        const other = await query(`INSERT INTO master_items (name, sub_type_id, price, destination_id, available, status, menu_id)
            VALUES ('Fuori serata', 1, 1, 1, TRUE, 'ACTIVE', ?)`, [menu2.insertId])
        expect((await order([fromMenu({ ...beer, id: other.insertId })])).status).toBe(400)

        const [{ tables: after }] = await query('SELECT COUNT(*) tables FROM tables')
        expect(after).toBe(before)
    })

    it('sends the server prices to the bar screen', async () => {
        const res = await waiter.get(`/api/orders/${eventId}/[1,2]`).expect(200)
        const prices = res.body.flatMap((o: any) => o.items.map((i: any) => i.price))
        expect(prices).not.toContain(0.01)
    })
})
