import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { closeApp, loadApp, loginAs, rawConnection, resetDatabase, RoleName } from './helpers'

/** An installation with every optional function switched off. */

let app: any
let users: Record<RoleName, number>

beforeAll(async () => {
    // Read when the app is loaded (each test file has its own modules)
    vi.stubEnv('FEATURES', '')
    vi.stubEnv('CLIENT_NAME', 'Circolo Test')
    vi.stubEnv('CLIENT_SLUG', 'circolo')
    users = await resetDatabase()
    app = await loadApp()
})

afterAll(async () => {
    vi.unstubAllEnvs()
    await closeApp()
})

describe('with FEATURES empty', () => {
    it('the client is told nothing is active, with the installation name', async () => {
        const res = await request(app).get('/api/public/config').expect(200)
        expect(res.body).toMatchObject({ name: 'Circolo Test', slug: 'circolo', features: [] })
    })

    it('the routes of the switched-off functions do not exist', async () => {
        const superuser = await loginAs(app, 'superuser')
        await superuser.get('/api/payment/settings').expect(404)
        await superuser.get('/api/payment/available').expect(404)
        await request(app).get('/api/public/payment/sumup/pos-callback?tx_id=1&sig=x').expect(404)
        await superuser.get('/api/push/config').expect(404)
        await superuser.post('/api/broadcast').send({ sender: { id: users.superuser }, message: 'ciao' }).expect(404)
        await request(app).get('/api/auth/google').expect(404)
    })

    it('events have no minimum consumption and orders refuse it, as they refuse PREMIUM', async () => {
        const admin = await loginAs(app, 'admin')
        const eventId = (await admin.post('/api/events').send({
            name: 'Serata', date: '2026-10-02', menu_id: 1, minimumConsumptionPrice: 5, users: [{ id: users.waiter }],
        }).expect(200)).body
        await admin.put(`/api/events/setstatus/${eventId}`).send({ status: 'ONGOING' }).expect(200)

        const conn = await rawConnection()
        const [[event]]: any = await conn.query('SELECT minimumConsumptionPrice FROM events WHERE id = ?', [eventId])
        await conn.end()
        expect(event.minimumConsumptionPrice).toBeNull()

        const waiter = await loginAs(app, 'waiter')
        const [item] = (await waiter.get('/api/master-items/available/1').expect(200)).body
        const order = (extra: object) => waiter.post('/api/orders')
            .send({ event_id: eventId, table_name: 'T', items: [{ master_item_id: item.id, ...extra }] })

        expect((await order({ setMinimum: true }).expect(400)).body.message).toBe('Consumazione minima non attiva')
        expect((await order({ premium: true }).expect(400)).body.message).toBe('Versione PREMIUM non attiva')
        await order({}).expect(200)
    })
})
