import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeApp, loadApp, loginAs, openEvent, rawConnection, resetDatabase, RoleName } from './helpers'

let app: any
let users: Record<RoleName, number>
let eventId: number

beforeAll(async () => {
    users = await resetDatabase()
    app = await loadApp()
    eventId = await openEvent(app, users)
})

afterAll(closeApp)

describe('prices are exact to the cent', () => {
    it('sums cents without floating point errors and returns numbers', async () => {
        const waiter = await loginAs(app, 'waiter')
        const extra = (price: number) => ({ name: 'Assaggio', price, destination_id: 1, sub_type: 'Fuori Menu' })
        const tableId = (await waiter.post('/api/orders').send({
            event_id: eventId, table_name: 'Centesimi', items: [extra(0.1), extra(0.2), extra(19.99), extra(0.7)],
        }).expect(200)).body

        const checkout = await loginAs(app, 'checkout')
        const table = (await checkout.get(`/api/events/${eventId}/tables`).expect(200)).body.find((t: any) => t.id === tableId)
        expect(table.items.map((i: any) => i.price)).toEqual([0.1, 0.2, 19.99, 0.7])

        const admin = await loginAs(app, 'admin')
        const event = (await admin.get('/api/events/status/ONGOING').expect(200)).body.find((e: any) => e.id === eventId)
        expect(event.revenue).toBe(20.99)
        expect(event.minimumConsumptionPrice).toBe(5)

        // A 3.33 discount on 20.99 leaves exactly 17.66 to pay
        await checkout.post(`/api/events/${eventId}/tables/${tableId}/discount/3.33`).expect(200)
        const conn = await rawConnection()
        const [[{ due }]]: any = await conn.query('SELECT SUM(price) due FROM items WHERE table_id = ?', [tableId])
        await conn.end()
        expect(Number(due)).toBe(17.66)
    })

    it('stores menu prices with two decimals', async () => {
        const conn = await rawConnection()
        const [[column]]: any = await conn.query(`
            SELECT DATA_TYPE type, NUMERIC_SCALE scale FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'master_items' AND column_name = 'price'`)
        await conn.end()
        expect(column).toEqual({ type: 'decimal', scale: 2 })

        const waiter = await loginAs(app, 'waiter')
        const menu = (await waiter.get('/api/master-items/available/1').expect(200)).body
        expect(menu.every((i: any) => typeof i.price === 'number')).toBe(true)
    })
})
