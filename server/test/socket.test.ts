import { AddressInfo } from 'net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { io as connect, Socket } from 'socket.io-client'
import { closeApp, loadApp, loginAs, PASSWORD, rawConnection, resetDatabase, ROLE_USERS, RoleName } from './helpers'

let app: any
let server: any
let baseUrl: string
let users: Record<RoleName, number>
const sockets: Socket[] = []

/** Logs in and returns the session cookie, to be sent with the socket handshake. */
async function sessionCookie(role: RoleName): Promise<string> {
    const res = await request(app).post('/api/login').send({ email: ROLE_USERS[role], password: PASSWORD })
    expect(res.status).toBe(200)
    return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0]
}

async function openSocket(cookie?: string): Promise<Socket> {
    const socket = connect(baseUrl, {
        path: '/socket',
        forceNew: true,
        reconnection: false,
        extraHeaders: cookie ? { cookie } : {},
    })
    sockets.push(socket)
    await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve)
        socket.once('connect_error', reject)
    })
    return socket
}

function join(socket: Socket, room: string): Promise<boolean> {
    return socket.timeout(5000).emitWithAck('join', room)
}

/** Records every occurrence of `event` received by the socket. */
function record(socket: Socket, event: string) {
    const received: unknown[] = []
    socket.on(event, body => received.push(body))
    return received
}

const nextEvent = (socket: Socket, event: string) =>
    new Promise(resolve => socket.once(event, resolve))

beforeAll(async () => {
    users = await resetDatabase()
    app = await loadApp()
    server = (await import('../src/app')).server
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
    sockets.forEach(s => s.disconnect())
    await new Promise(resolve => server.close(resolve))
    await closeApp()
})

describe('socket rooms', () => {
    it('refuses every room to an anonymous socket', async () => {
        const socket = await openSocket()
        for (const room of ['main', 'waiter', 'bartender', 'checkout', 'table']) {
            expect(await join(socket, room)).toBe(false)
        }
    })

    it('admits a logged user only to the rooms of its roles', async () => {
        const waiter = await openSocket(await sessionCookie('waiter'))
        expect(await join(waiter, 'main')).toBe(true)
        expect(await join(waiter, 'waiter')).toBe(true)
        expect(await join(waiter, 'table')).toBe(true)
        expect(await join(waiter, 'bartender')).toBe(true)
        expect(await join(waiter, 'checkout')).toBe(false)
        expect(await join(waiter, 'session:whatever')).toBe(false)

        // The waiter screen is open to bartenders too
        const bartender = await openSocket(await sessionCookie('bartender'))
        expect(await join(bartender, 'waiter')).toBe(true)
        expect(await join(bartender, 'checkout')).toBe(false)

        const admin = await openSocket(await sessionCookie('admin'))
        expect(await join(admin, 'main')).toBe(true)
        expect(await join(admin, 'checkout')).toBe(false)

        const superuser = await openSocket(await sessionCookie('superuser'))
        expect(await join(superuser, 'checkout')).toBe(true)
        expect(await join(superuser, 'bartender')).toBe(true)
    })

    it('does not upgrade a socket opened before login: the session id changes', async () => {
        const anonymous = await request(app).get('/api/checkauthentication')
        const cookie = (anonymous.headers['set-cookie'] as unknown as string[])[0].split(';')[0]
        const socket = await openSocket(cookie)

        const login = await request(app).post('/api/login').set('Cookie', cookie)
            .send({ email: ROLE_USERS.checkout, password: PASSWORD })
        expect(login.status).toBe(200)

        expect(await join(socket, 'checkout')).toBe(false)
    })

    it('checks the roles held now, not those of the login', async () => {
        const cookie = await sessionCookie('bartender')
        const socket = await openSocket(cookie)
        expect(await join(socket, 'bartender')).toBe(true)

        const conn = await rawConnection()
        await conn.query('DELETE FROM user_role WHERE user_id = ?', [users.bartender])
        try {
            expect(await join(socket, 'waiter')).toBe(false)
        } finally {
            await conn.query(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 1 FROM roles WHERE name = 'bartender'`,
                [users.bartender])
            await conn.end()
        }
    })

    it('disconnects the sockets of a session on logout', async () => {
        const cookie = await sessionCookie('checkout')
        const socket = await openSocket(cookie)
        expect(await join(socket, 'checkout')).toBe(true)

        const disconnected = nextEvent(socket, 'disconnect')
        await request(app).post('/api/logout').set('Cookie', cookie).expect(200)
        await disconnected
    })
})

describe('venues', () => {
    it('keeps the messages of a venue inside it', async () => {
        const conn = await rawConnection()
        await conn.query(`INSERT IGNORE INTO venues (id, name) VALUES (2, 'Secondo')`)
        await conn.end()
        const superuserCookie = await sessionCookie('superuser')
        // Two venues now: the superuser picks the second one
        await request(app).put('/api/session/venue').set('Cookie', superuserCookie).send({ venueId: 2 }).expect(200)

        const inVenue2 = await openSocket(superuserCookie)
        expect(await join(inVenue2, 'main')).toBe(true)
        const inVenue1 = await openSocket(await sessionCookie('checkout'))
        expect(await join(inVenue1, 'main')).toBe(true)
        const venue2Received = record(inVenue2, 'broadcast')
        const venue1Received = nextEvent(inVenue1, 'broadcast')

        const waiter = await loginAs(app, 'waiter')
        await waiter.post('/api/broadcast').send({ sender: { id: users.waiter }, message: 'ciao' }).expect(200)

        expect(await venue1Received).toMatchObject({ message: 'ciao' })
        await new Promise(resolve => setTimeout(resolve, 300))
        expect(venue2Received).toHaveLength(0)
    })

    it('drops the sockets of a session that switches venue, and of a user whose roles change', async () => {
        const superuserCookie = await sessionCookie('superuser')
        await request(app).put('/api/session/venue').set('Cookie', superuserCookie).send({ venueId: 1 }).expect(200)
        const own = await openSocket(superuserCookie)
        expect(await join(own, 'main')).toBe(true)
        const switched = nextEvent(own, 'disconnect')
        await request(app).put('/api/session/venue').set('Cookie', superuserCookie).send({ venueId: 2 }).expect(200)
        await switched

        await request(app).put('/api/session/venue').set('Cookie', superuserCookie).send({ venueId: 1 }).expect(200)
        const bartender = await openSocket(await sessionCookie('bartender'))
        expect(await join(bartender, 'bartender')).toBe(true)
        const dropped = nextEvent(bartender, 'disconnect')
        await request(app).put('/api/users/roles').set('Cookie', superuserCookie)
            .send({ id: users.bartender, roles: ['bartender', 'waiter'] }).expect(200)
        await dropped
    })
})

describe('table notifications', () => {
    it('reach a logged-in checkout socket but not an anonymous one', async () => {
        const admin = await loginAs(app, 'admin')
        const waiter = await loginAs(app, 'waiter')
        const checkoutCookie = await sessionCookie('checkout')

        const eventId = (await admin.post('/api/events').send({
            name: 'Serata socket',
            date: '2026-10-02T18:00:00.000Z',
            menu_id: 1,
            minimumConsumptionPrice: 0,
            users: [{ id: users.waiter }, { id: users.checkout }],
        }).expect(200)).body
        await admin.put(`/api/events/setstatus/${eventId}`).send({ id: eventId, status: 'ONGOING' }).expect(200)

        const layout = await waiter.get(`/api/events/${eventId}/tables/layout`).expect(200)
        const [beer] = (await waiter.get('/api/master-items/available/1').expect(200)).body
        const tableId = (await waiter.post('/api/orders').send({
            event_id: eventId,
            table_name: 'Tavolo socket',
            master_table_id: layout.body.tables[0].id,
            items: [{
                master_item_id: beer.id, type: beer.type, sub_type: beer.sub_type, name: beer.name, price: beer.price,
                destination_id: beer.destination_id, icon: beer.icon, done: false, paid: false,
            }],
        }).expect(200)).body

        const anonymous = await openSocket()
        for (const room of ['main', 'waiter', 'table', 'checkout']) await join(anonymous, room)
        const anonymousReceived = record(anonymous, 'reload-table')

        const checkout = await openSocket(checkoutCookie)
        expect(await join(checkout, 'checkout')).toBe(true)
        const checkoutReceived = nextEvent(checkout, 'reload-table')

        await request(app).put(`/api/tables/${tableId}/complete`).set('Cookie', checkoutCookie).expect(200)

        await checkoutReceived
        // Same broadcast: give the anonymous socket time to (not) receive it as well
        await new Promise(resolve => setTimeout(resolve, 300))
        expect(anonymousReceived).toHaveLength(0)
    })
})
