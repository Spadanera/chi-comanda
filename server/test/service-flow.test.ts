import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeApp, loadApp, loginAs, rawConnection, resetDatabase, RoleName } from './helpers'

let app: any
let users: Record<RoleName, number>
let agents: Record<'admin' | 'waiter' | 'bartender' | 'checkout', any>

const state: {
    eventId?: number
    masterTableId?: number
    tableId?: number
    orderId?: number
    itemIds?: number[]
} = {}

beforeAll(async () => {
    users = await resetDatabase()
    app = await loadApp()
    agents = {
        admin: await loginAs(app, 'admin'),
        waiter: await loginAs(app, 'waiter'),
        bartender: await loginAs(app, 'bartender'),
        checkout: await loginAs(app, 'checkout'),
    }
})

afterAll(closeApp)

describe('a full service: event → order → bar → checkout → close', () => {
    it('admin creates an event with staff', async () => {
        const res = await agents.admin.post('/api/events').send({
            name: 'Serata test',
            date: '2026-10-02T18:00:00.000Z',
            menu_id: 1,
            minimumConsumptionPrice: 5,
            users: [{ id: users.waiter }, { id: users.bartender }, { id: users.checkout }],
        })
        expect(res.status).toBe(200)
        expect(res.body).toBeGreaterThan(0)
        state.eventId = res.body

        const planned = await agents.admin.get('/api/events/status/PLANNED')
        expect(planned.body.map((e: any) => e.id)).toContain(state.eventId)
    })

    it('admin starts the event, copying the master tables layout', async () => {
        const res = await agents.admin.put(`/api/events/setstatus/${state.eventId}`).send({ id: state.eventId, status: 'ONGOING' })
        expect(res.status).toBe(200)

        const ongoing = await agents.waiter.get('/api/events/ongoing')
        expect(ongoing.body.id).toBe(state.eventId)
        expect(ongoing.body.users).toHaveLength(3)

        const layout = await agents.waiter.get(`/api/events/${state.eventId}/tables/layout`)
        expect(layout.status).toBe(200)
        expect(layout.body.rooms.length).toBeGreaterThan(0)
        expect(layout.body.tables.length).toBe(21)
        expect(layout.body.tables.every((t: any) => t.inUse === 0)).toBe(true)
        state.masterTableId = layout.body.tables[0].id
    })

    it('waiter places an order on a free table', async () => {
        const menu = await agents.waiter.get('/api/master-items/available/1')
        expect(menu.status).toBe(200)
        const [beer, cocktail] = [menu.body[0], menu.body.find((i: any) => i.sub_type === 'Cocktail')]

        const res = await agents.waiter.post('/api/orders').send({
            event_id: state.eventId,
            table_name: 'Tavolo 1',
            master_table_id: state.masterTableId,
            items: [beer, cocktail].map(i => ({
                master_item_id: i.id, type: i.type, sub_type: i.sub_type, name: i.name,
                price: i.price, destination_id: i.destination_id, icon: i.icon, done: false, paid: false,
            })),
        })
        expect(res.status).toBe(200)
        state.tableId = res.body

        const layout = await agents.waiter.get(`/api/events/${state.eventId}/tables/layout`)
        const used = layout.body.tables.find((t: any) => t.table_id === state.tableId)
        expect(used).toMatchObject({ inUse: 1, id: state.masterTableId, table_name: 'Tavolo 1' })
        expect(used.items).toHaveLength(2)
    })

    it('bartender sees the order and completes it', async () => {
        const orders = await agents.bartender.get(`/api/orders/${state.eventId}/[1,2]`)
        expect(orders.status).toBe(200)
        expect(orders.body).toHaveLength(1)
        const order = orders.body[0]
        expect(order).toMatchObject({ table_id: state.tableId, table_name: 'Tavolo 1', done: 0 })
        // Italian wall-clock time, independent of the server timezone (the bar computes waiting minutes from it)
        expect(order.order_date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
        const conn = await rawConnection()
        const [[stored]]: any = await conn.query(`SELECT DATE_FORMAT(order_date, '%Y-%m-%d %H:%i:%s') d FROM orders WHERE id = ?`, [order.id])
        await conn.end()
        expect(order.order_date).toBe(stored.d)
        expect(order.items).toHaveLength(2)
        state.orderId = order.id
        state.itemIds = order.items.map((i: any) => i.id)

        await agents.bartender.put(`/api/orders/${state.orderId}/complete`).send({ item_ids: [state.itemIds![0]] }).expect(200)
        let after = await agents.bartender.get(`/api/orders/${state.eventId}/[1,2]`)
        expect(after.body[0].done).toBe(0)

        await agents.bartender.put(`/api/orders/${state.orderId}/complete`).send({ item_ids: [state.itemIds![1]] }).expect(200)
        after = await agents.bartender.get(`/api/orders/${state.eventId}/[1,2]`)
        expect(after.body[0].done).toBe(1)
    })

    it('rejects a malformed destinations list', async () => {
        const res = await agents.bartender.get(`/api/orders/${state.eventId}/not-json`)
        expect(res.status).toBe(400)
    })

    it('checkout pays one item, applies a discount and closes the table', async () => {
        const getTable = async () => {
            const res = await agents.checkout.get(`/api/events/${state.eventId}/tables`)
            expect(res.status).toBe(200)
            return res.body.find((t: any) => t.id === state.tableId)
        }
        expect((await getTable()).items).toHaveLength(2)

        await agents.checkout.put(`/api/tables/${state.tableId}/payitems`).send([state.itemIds![0]]).expect(200)
        await agents.checkout.post(`/api/events/${state.eventId}/tables/${state.tableId}/discount/2`).expect(200)

        const afterPay = await getTable()
        const byId = Object.fromEntries(afterPay.items.map((i: any) => [i.id, i]))
        expect(byId[state.itemIds![0]].paid).toBeTruthy()
        expect(byId[state.itemIds![1]].paid).toBeFalsy()
        const discount = afterPay.items.find((i: any) => i.type === 'Sconto')
        expect(discount.price).toBe(-2)

        await agents.checkout.put(`/api/tables/${state.tableId}/complete`).expect(200)
        const closed = await getTable()
        expect(closed.status).toBe('CLOSED')
        expect(closed.items.every((i: any) => i.paid)).toBe(true)

        const free = await agents.checkout.get(`/api/events/${state.eventId}/tables/free`)
        expect(free.body.map((t: any) => t.table_id)).toContain(state.masterTableId)
    })

    it('admin sees revenue and closes the event into history', async () => {
        const list = await agents.admin.get('/api/events/status/ONGOING')
        const ev = list.body.find((e: any) => e.id === state.eventId)
        expect(ev).toMatchObject({ tableCount: 1, tablesOpen: 0, discount: -2 })
        expect(ev.revenue).toBeGreaterThan(0)

        await agents.admin.put(`/api/events/setstatus/${state.eventId}`).send({ id: state.eventId, status: 'CLOSED' }).expect(200)

        const conn = await rawConnection()
        const [[counts]]: any = await conn.query(
            `SELECT (SELECT COUNT(*) FROM items WHERE event_id = ?) live_items,
                    (SELECT COUNT(*) FROM items_history WHERE event_id = ?) hist_items,
                    (SELECT COUNT(*) FROM tables_history WHERE event_id = ?) hist_tables`,
            [state.eventId, state.eventId, state.eventId])
        await conn.end()
        expect(counts).toMatchObject({ live_items: 0, hist_items: 3, hist_tables: 1 })

        const detail = await agents.admin.get(`/api/events/${state.eventId}/status/CLOSED`)
        expect(detail.status).toBe(200)
        expect(detail.body.tables).toHaveLength(1)
    })
})

describe('admin catalogue', () => {
    it('copies only the source menu items when cloning a menu', async () => {
        const created = await agents.admin.post('/api/menu').send({ name: 'Empty' })
        const emptyMenuId = created.body
        await agents.admin.post('/api/master-items').send({
            name: 'Only here', sub_type_id: 1, price: 1, destination_id: 1, available: true, status: 'ACTIVE', menu_id: emptyMenuId,
        }).expect(200)

        const clone = await agents.admin.post('/api/menu').send({ name: 'Clone', from_id: emptyMenuId })
        const items = await agents.admin.get(`/api/master-items/${clone.body}`)
        expect(items.body.map((i: any) => i.name)).toEqual(['Only here'])
    })

    it('refuses to delete a type that still has sub types', async () => {
        const res = await agents.admin.delete('/api/types/1')
        expect(res.status).toBe(409)
    })

    it('saves the master layout even when every room is new', async () => {
        const layout = (await agents.admin.get('/api/master-tables/layout')).body
        const res = await agents.admin.put('/api/master-tables/layout').send({
            rooms: [{ id: -1, name: 'Nuova sala', width: 5, height: 5 }],
            tables: [{ id: -1, name: 'T1', default_seats: 4, status: 'ACTIVE', room_id: -1, x: 1, y: 1, width: 10, height: 10, shape: 'rect' }],
        })
        expect(res.status).toBe(200)
        const after = (await agents.admin.get('/api/master-tables/layout')).body
        expect(after.rooms.map((r: any) => r.name)).toEqual(['Nuova sala'])
        expect(after.tables.map((t: any) => t.name)).toEqual(['T1'])
        expect(layout.rooms.length).toBeGreaterThan(0)
    })
})

describe('audit', () => {
    it('paginates and ignores unknown sort columns', async () => {
        const superuser = await loginAs(app, 'superuser')
        const ok = await superuser.get('/api/audit?page=1&itemsperpage=5&sortby=dateTime&sortdir=desc')
        expect(ok.status).toBe(200)
        expect(ok.body.data.length).toBeLessThanOrEqual(5)
        expect(ok.body.totalCount).toBeGreaterThan(0)

        const injected = await superuser.get('/api/audit?page=1&itemsperpage=5&sortby=' + encodeURIComponent('(SELECT SLEEP(5))'))
        expect(injected.status).toBe(200)
    })
})
