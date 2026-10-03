import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { closeApp, loadApp, loginAs, rawConnection, resetDatabase, RoleName } from './helpers'

let app: any
let ids: Record<RoleName, number>

async function sql(query: string, params: unknown[] = []): Promise<any[]> {
    const conn = await rawConnection()
    try {
        const [rows] = await conn.query(query, params)
        return rows as any[]
    } finally {
        await conn.end()
    }
}

const rolesOf = async (userId: number) => (await sql(`
    SELECT user_role.venue_id, roles.name FROM user_role INNER JOIN roles ON roles.id = user_role.role_id
    WHERE user_id = ? ORDER BY venue_id, roles.name`, [userId])).map(r => `${r.venue_id ?? 'platform'}:${r.name}`)

/** The superuser, working in venue `venueId`. */
async function superuserIn(venueId: number) {
    const agent = await loginAs(app, 'superuser')
    await agent.put('/api/session/venue').send({ venueId }).expect(200)
    return agent
}

beforeAll(async () => {
    app = await loadApp()
})

beforeEach(async () => {
    ids = await resetDatabase()
    await sql(`INSERT INTO venues (id, name) VALUES (2, 'Secondo')`)
})

afterAll(async () => {
    await resetDatabase()
    await closeApp()
})

describe('staff of a venue', () => {
    it('lists only the members of the active venue', async () => {
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'waiter'`, [ids.bartender])
        const in2 = await superuserIn(2)
        expect((await in2.get('/api/users')).body.map((u: any) => [u.id, u.roles])).toEqual([[ids.bartender, ['waiter']]])
        // The people that can be staffed on an event: members and the platform's superusers, nobody else of venue 1
        const available = (await in2.get('/api/events/users')).body.map((u: any) => u.id)
        expect(available).toContain(ids.bartender)
        expect(available).toContain(ids.superuser)
        expect(available).not.toContain(ids.waiter)
        expect(available).not.toContain(ids.admin)
    })

    it('adds an existing account to another venue without a new invitation', async () => {
        const { default: sendEmail } = await import('../src/utils/mail')
        vi.mocked(sendEmail).mockClear()
        const in2 = await superuserIn(2)
        await in2.post('/api/users/invite').send({ email: 'waiter@test.local', roles: ['checkout'] }).expect(200)

        expect(await rolesOf(ids.waiter)).toEqual(['1:waiter', '2:checkout'])
        expect((await sql(`SELECT COUNT(*) n FROM users WHERE email = 'waiter@test.local'`))[0].n).toBe(1)
        expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({ to: 'waiter@test.local', subject: 'Ora lavori anche con Secondo' })
        // Twice in the same venue: refused, as before venues existed
        await in2.post('/api/users/invite').send({ email: 'waiter@test.local', roles: ['waiter'] }).expect(400)

        const waiter = await loginAs(app, 'waiter')
        expect((await waiter.get('/api/checkauthentication')).body.venues.map((v: any) => v.id)).toEqual([1, 2])
    })

    it('invites a new e-mail into the active venue only', async () => {
        const in2 = await superuserIn(2)
        await in2.post('/api/users/invite').send({ email: 'nuovo@test.local', roles: ['bartender'] }).expect(200)
        const [user] = await sql(`SELECT id, token FROM users WHERE email = 'nuovo@test.local'`)
        expect(await rolesOf(user.id)).toEqual(['2:bartender'])

        await request(app).post('/public/invitation/accept')
            .field('token', user.token).field('username', 'nuovo').field('password', 'Secret123!').expect(200)
        const login = await request(app).post('/api/login').send({ email: 'nuovo@test.local', password: 'Secret123!' })
        expect(login.body).toMatchObject({ venueId: 2, roles: ['bartender'] })
    })

    it('changes roles in the active venue without touching the others', async () => {
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'waiter'`, [ids.admin])
        const in2 = await superuserIn(2)
        await in2.put('/api/users/roles').send({ id: ids.admin, roles: ['checkout', 'bartender'] }).expect(200)
        expect(await rolesOf(ids.admin)).toEqual(['1:admin', '2:bartender', '2:checkout'])

        await in2.put('/api/users/roles').send({ id: ids.admin, roles: ['owner'] }).expect(400)
        await in2.put('/api/users/roles').send({ id: 99999, roles: ['waiter'] }).expect(404)
    })

    it('removes from the venue, and deletes the account only when no venue is left', async () => {
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'waiter'`, [ids.waiter])
        const in2 = await superuserIn(2)
        await in2.delete(`/api/users/${ids.waiter}`).expect(200)
        expect(await rolesOf(ids.waiter)).toEqual(['1:waiter'])
        expect((await sql('SELECT status FROM users WHERE id = ?', [ids.waiter]))[0].status).toBe('ACTIVE')

        const in1 = await superuserIn(1)
        await in1.delete(`/api/users/${ids.waiter}`).expect(200)
        expect((await sql('SELECT status FROM users WHERE id = ?', [ids.waiter]))[0].status).toBe('DELETED')
    })

    it('refuses to staff an event with somebody of another venue', async () => {
        const in2 = await superuserIn(2)
        const menu = await sql(`INSERT INTO menu (venue_id, name, status) VALUES (2, 'Menu', 'ACTIVE')`) as any
        await in2.post('/api/events').send({ name: 'Serata', date: '2026-10-02', menu_id: menu.insertId, users: [{ id: ids.waiter }] })
            .expect(404)
        await in2.post('/api/events').send({ name: 'Serata', date: '2026-10-02', menu_id: menu.insertId, users: [] }).expect(200)
    })
})

describe('staff managed by the venue admin', () => {
    it('lets an admin manage the staff of their venue, never the platform role', async () => {
        const admin = await loginAs(app, 'admin')
        await admin.put('/api/users/roles').send({ id: ids.waiter, roles: ['waiter', 'checkout', 'superuser'] }).expect(200)
        expect(await rolesOf(ids.waiter)).toEqual(['1:checkout', '1:waiter'])
        // The platform's superuser is not staff of the venue: out of the admin's reach
        await admin.put('/api/users/roles').send({ id: ids.superuser, roles: ['waiter'] }).expect(404)
        await admin.post('/api/users/invite').send({ email: 'nuovo-admin@test.local', roles: ['superuser'] }).expect(200)
        const [invited] = await sql(`SELECT id FROM users WHERE email = 'nuovo-admin@test.local'`)
        expect(await rolesOf(invited.id)).toEqual([])
    })

    it('offers to pick the people of the venues one runs, every account to the superuser', async () => {
        // The admin of venue 1 is admin of venue 2 too: venue 2's people can be picked for venue 1, not venue 3's
        await sql(`INSERT INTO venues (id, name) VALUES (3, 'Terzo')`)
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'admin'`, [ids.admin])
        const inTwo = await sql(`INSERT INTO users (email, username, status) VALUES ('due@test.local', 'due', 'ACTIVE')`) as any
        const inThree = await sql(`INSERT INTO users (email, username, status) VALUES ('tre@test.local', 'tre', 'ACTIVE')`) as any
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'waiter'`, [inTwo.insertId])
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 3 FROM roles WHERE name = 'waiter'`, [inThree.insertId])

        const admin = await loginAs(app, 'admin')
        await admin.put('/api/session/venue').send({ venueId: 1 })
        const picked = (await admin.get('/api/users/candidates').expect(200)).body.map((u: any) => u.email)
        expect(picked).toContain('due@test.local')
        expect(picked).not.toContain('tre@test.local')
        // Members of the venue are not offered again
        expect(picked).not.toContain('waiter@test.local')

        const everybody = (await (await superuserIn(1)).get('/api/users/candidates').expect(200)).body.map((u: any) => u.email)
        expect(everybody).toEqual(expect.arrayContaining(['due@test.local', 'tre@test.local']))
    })

    it('links the "added to a venue" e-mail to that venue', async () => {
        const { default: sendEmail } = await import('../src/utils/mail')
        vi.mocked(sendEmail).mockClear()
        await (await superuserIn(2)).post('/api/users/invite').send({ email: 'waiter@test.local', roles: ['checkout'] }).expect(200)
        const mail = vi.mocked(sendEmail).mock.calls[0][0] as any
        expect(mail.html).toContain('/?venue=2')
        expect(mail.text).toContain('Il tuo ruolo: Cassiere')
    })

    it('lets an admin block only accounts working in their venue alone', async () => {
        const admin = await loginAs(app, 'admin')
        await admin.put('/api/users').send({ id: ids.waiter, status: 'BLOCKED' }).expect(200)
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'waiter'`, [ids.checkout])
        const res = await admin.put('/api/users').send({ id: ids.checkout, status: 'BLOCKED' })
        expect(res.status).toBe(409)
        expect((await sql('SELECT status FROM users WHERE id = ?', [ids.checkout]))[0].status).toBe('ACTIVE')
    })
})

describe('platform', () => {
    it('is reserved to the superuser', async () => {
        const admin = await loginAs(app, 'admin')
        await admin.get('/api/platform/venues').expect(403)
        await admin.post('/api/platform/venues').send({ name: 'X' }).expect(403)
        await request(app).get('/api/platform/venues').expect(401)
    })

    it('creates a venue with the default catalogue and invites its first admin', async () => {
        const superuser = await loginAs(app, 'superuser')
        const venueId = (await superuser.post('/api/platform/venues')
            .send({ name: 'Terzo', features: ['payments'], admin_email: 'capo@test.local' }).expect(200)).body

        expect(await sql('SELECT name, features FROM venues WHERE id = ?', [venueId])).toEqual([{ name: 'Terzo', features: ['payments'] }])
        expect((await sql('SELECT COUNT(*) n FROM types WHERE venue_id = ?', [venueId]))[0].n).toBe(2)
        expect((await sql('SELECT COUNT(*) n FROM sub_types WHERE venue_id = ?', [venueId]))[0].n).toBe(8)
        expect(await sql('SELECT name FROM menu WHERE venue_id = ?', [venueId])).toEqual([{ name: 'Menu Principale' }])
        const [capo] = await sql(`SELECT id FROM users WHERE email = 'capo@test.local'`)
        expect(await rolesOf(capo.id)).toEqual([`${venueId}:admin`])

        const venues = (await superuser.get('/api/platform/venues').expect(200)).body
        expect(venues.find((v: any) => v.id === venueId)).toMatchObject({ name: 'Terzo', status: 'ACTIVE', members: 1 })

        await superuser.post('/api/platform/venues').send({ name: '' }).expect(400)
        await superuser.post('/api/platform/venues').send({ name: 'Y', features: ['teleport'] }).expect(400)
    })

    it('disables a venue for its staff at once', async () => {
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'waiter'`, [ids.waiter])
        const waiter = await loginAs(app, 'waiter')
        expect((await waiter.get('/api/checkauthentication')).body.venues).toHaveLength(2)

        const superuser = await loginAs(app, 'superuser')
        await superuser.put('/api/platform/venues/2').send({ status: 'DISABLED' }).expect(200)
        expect((await waiter.get('/api/checkauthentication')).body.venues.map((v: any) => v.id)).toEqual([1])
        await superuser.put('/api/platform/venues/999').send({ status: 'ACTIVE' }).expect(404)
    })

    it('lists every user with the venues they work in', async () => {
        await sql(`INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, 2 FROM roles WHERE name = 'checkout'`, [ids.waiter])
        const superuser = await loginAs(app, 'superuser')
        const users = (await superuser.get('/api/platform/users').expect(200)).body
        expect(users.find((u: any) => u.id === ids.waiter)).toMatchObject({
            superuser: false,
            venues: [{ id: 1, name: 'Chi Comanda', roles: ['waiter'] }, { id: 2, name: 'Secondo', roles: ['checkout'] }],
        })
        expect(users.find((u: any) => u.id === ids.superuser)).toMatchObject({ superuser: true, venues: [] })
    })
})
