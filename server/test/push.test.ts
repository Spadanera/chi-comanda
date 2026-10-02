import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcrypt'
import { closeApp, loadApp, loginAs, PASSWORD, rawConnection, resetDatabase, RoleName } from './helpers'
import request from 'supertest'

const sendNotification = vi.fn(async (..._args: any[]) => ({ statusCode: 201 }))
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...args: any[]) => sendNotification(...args) } }))

let app: any
let users: Record<RoleName, number>
/** A second bartender (serving destination 2) and one not staffed on the event. */
const extra = { bar2: 0, offDuty: 0 }

const endpoint = (who: string) => `https://push.example.test/${who}`
const subscription = (who: string) => ({ endpoint: endpoint(who), keys: { p256dh: `p256dh-${who}`, auth: `auth-${who}` } })

async function createBartender(email: string): Promise<number> {
    const conn = await rawConnection()
    const [res]: any = await conn.query(`INSERT INTO users (email, username, password, status) VALUES (?, ?, ?, 'ACTIVE')`,
        [email, email.split('@')[0], await bcrypt.hash(PASSWORD, 4)])
    await conn.query(`INSERT INTO user_role (user_id, role_id) SELECT ?, id FROM roles WHERE name = 'bartender'`, [res.insertId])
    await conn.end()
    return res.insertId
}

async function loginEmail(email: string) {
    const agent = request.agent(app)
    await agent.post('/api/login').send({ email, password: PASSWORD }).expect(200)
    return agent
}

/** Notifications sent, as { endpoint, payload } */
function sent() {
    return sendNotification.mock.calls.map(([sub, body]) => ({ endpoint: sub.endpoint, payload: JSON.parse(body) }))
}

const item = (name: string, destination_id: number) => ({
    master_item_id: 1, type: 'Bevanda', sub_type: 'Cocktail', name, price: 5, destination_id, icon: 'mdi-glass-cocktail', done: false, paid: false,
})

let eventId: number

beforeAll(async () => {
    users = await resetDatabase()
    const conn = await rawConnection()
    await conn.query(`DELETE FROM user_role WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@push.test')`)
    await conn.query(`DELETE FROM users WHERE email LIKE '%@push.test'`)
    await conn.query('TRUNCATE TABLE push_subscriptions')
    await conn.query(`UPDATE users SET push_orders = NULL`)
    await conn.end()
    extra.bar2 = await createBartender('bar2@push.test')
    extra.offDuty = await createBartender('offduty@push.test')
    app = await loadApp()

    const admin = await loginAs(app, 'admin')
    eventId = (await admin.post('/api/events').send({
        name: 'Serata push', date: '2026-10-02', menu_id: 1,
        users: [{ id: users.waiter }, { id: users.bartender, destination_id: 1 }, { id: extra.bar2, destination_id: 2 }],
    }).expect(200)).body
    await admin.put(`/api/events/setstatus/${eventId}`).send({ status: 'ONGOING' }).expect(200)
})

beforeEach(() => {
    sendNotification.mockReset()
    sendNotification.mockImplementation(async () => ({ statusCode: 201 }))
})

afterAll(closeApp)

describe('push preferences', () => {
    it('exposes the VAPID public key', async () => {
        const waiter = await loginAs(app, 'waiter')
        const res = await waiter.get('/api/push/config').expect(200)
        expect(res.body).toEqual({ enabled: true, publicKey: expect.any(String) })
    })

    it('starts unset, so the bartender is asked', async () => {
        const bartender = await loginAs(app, 'bartender')
        expect((await bartender.get('/api/push/preference').expect(200)).body).toEqual({ preference: null })
    })

    it('is only for bartenders', async () => {
        const waiter = await loginAs(app, 'waiter')
        expect((await waiter.get('/api/push/preference')).status).toBe(403)
        expect((await waiter.post('/api/push/subscriptions').send(subscription('waiter'))).status).toBe(403)
    })

    it('rejects malformed subscriptions', async () => {
        const bartender = await loginAs(app, 'bartender')
        expect((await bartender.post('/api/push/subscriptions').send({ endpoint: 'http://insecure', keys: {} })).status).toBe(400)
    })

    it('turns on when a device subscribes', async () => {
        const bartender = await loginAs(app, 'bartender')
        await bartender.post('/api/push/subscriptions').send(subscription('bar1')).expect(200)
        expect((await bartender.get('/api/push/preference')).body).toEqual({ preference: true })

        await (await loginEmail('bar2@push.test')).post('/api/push/subscriptions').send(subscription('bar2')).expect(200)
        await (await loginEmail('offduty@push.test')).post('/api/push/subscriptions').send(subscription('offduty')).expect(200)
    })
})

describe('new order notifications', () => {
    it('reach only the staffed bartenders, each with the items of their destination', async () => {
        const waiter = await loginAs(app, 'waiter')
        await waiter.post('/api/orders').send({
            event_id: eventId, table_name: 'Tavolo 7',
            items: [item('Negroni', 1), item('Negroni', 1), item('Nachos', 2)],
        }).expect(200)

        await vi.waitFor(() => expect(sendNotification).toHaveBeenCalledTimes(2))
        const byEndpoint = Object.fromEntries(sent().map(s => [s.endpoint, s.payload]))
        expect(Object.keys(byEndpoint).sort()).toEqual([endpoint('bar1'), endpoint('bar2')])
        expect(byEndpoint[endpoint('bar1')]).toMatchObject({ title: 'Nuovo ordine · Tavolo 7', body: '2× Negroni', url: expect.stringMatching(/^\/bartender\/1\//) })
        expect(byEndpoint[endpoint('bar2')]).toMatchObject({ body: '1× Nachos', url: expect.stringMatching(/^\/bartender\/2\//) })
    })

    it('skip bartenders with nothing to prepare and the one who placed the order', async () => {
        const bartender = await loginAs(app, 'bartender')
        await bartender.post('/api/orders').send({ event_id: eventId, table_name: 'Tavolo 8', items: [item('Spritz', 1)] }).expect(200)
        const waiter = await loginAs(app, 'waiter')
        await waiter.post('/api/orders').send({ event_id: eventId, table_name: 'Tavolo 9', items: [item('Birra', 2)] }).expect(200)

        await vi.waitFor(() => expect(sendNotification).toHaveBeenCalledTimes(1))
        await new Promise(r => setTimeout(r, 200))
        expect(sent().map(s => s.endpoint)).toEqual([endpoint('bar2')])
    })

    it('skip orders entered as already served', async () => {
        const waiter = await loginAs(app, 'waiter')
        await waiter.post('/api/orders').send({ event_id: eventId, table_name: 'Banco', items: [{ ...item('Acqua', 1), done: true }] }).expect(200)
        await new Promise(r => setTimeout(r, 300))
        expect(sendNotification).not.toHaveBeenCalled()
    })

    it('forget a device whose subscription expired', async () => {
        sendNotification.mockImplementation(async (sub: any) => {
            if (sub.endpoint === endpoint('bar1')) throw Object.assign(new Error('Gone'), { statusCode: 410 })
            return { statusCode: 201 }
        })
        const waiter = await loginAs(app, 'waiter')
        await waiter.post('/api/orders').send({ event_id: eventId, table_name: 'Tavolo 10', items: [item('Gin Tonic', 1)] }).expect(200)
        await vi.waitFor(async () => {
            const conn = await rawConnection()
            const [rows]: any = await conn.query('SELECT endpoint FROM push_subscriptions WHERE user_id = ?', [users.bartender])
            await conn.end()
            expect(rows).toEqual([])
        })
    })

    it('stop when the bartender turns them off', async () => {
        const bar2 = await loginEmail('bar2@push.test')
        await bar2.put('/api/push/preference').send({ enabled: false }).expect(200)
        expect((await bar2.get('/api/push/preference')).body).toEqual({ preference: false })

        const waiter = await loginAs(app, 'waiter')
        await waiter.post('/api/orders').send({ event_id: eventId, table_name: 'Tavolo 11', items: [item('Nachos', 2)] }).expect(200)
        await new Promise(r => setTimeout(r, 300))
        expect(sendNotification).not.toHaveBeenCalled()
    })
})
