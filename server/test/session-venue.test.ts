import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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

async function grant(userId: number, role: string, venueId: number | null) {
    await sql('INSERT INTO user_role (user_id, role_id, venue_id) SELECT ?, id, ? FROM roles WHERE name = ?', [userId, venueId, role])
}

const revoke = (userId: number, role: string) =>
    sql('DELETE FROM user_role WHERE user_id = ? AND role_id = (SELECT id FROM roles WHERE name = ?)', [userId, role])

const sessionUser = async (agent: any) => (await agent.get('/api/checkauthentication')).body

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

describe('session and active venue', () => {
    it('enters the only venue the user can work in', async () => {
        const res = await request(app).post('/api/login').send({ email: 'admin@test.local', password: 'Password1!' })

        expect(res.body).toMatchObject({ venueId: 1, roles: ['admin'], superuser: false })
        expect(res.body.venues).toEqual([{ id: 1, name: 'Chi Comanda', roles: ['admin'] }])
        expect(res.body).not.toHaveProperty('password')
    })

    it('applies a role change on the next request, without logging in again', async () => {
        const admin = await loginAs(app, 'admin')
        expect((await admin.get('/api/menu')).status).toBe(200)

        await revoke(ids.admin, 'admin')
        await grant(ids.admin, 'waiter', 1)
        // Still in venue 1 as a waiter: the admin screens are gone
        expect((await admin.get('/api/menu')).status).toBe(403)
        expect(await sessionUser(admin)).toMatchObject({ venueId: 1, roles: ['waiter'] })

        await revoke(ids.admin, 'waiter')
        // No venue left: the venue api asks for one, the session itself survives
        expect((await admin.get('/api/menu')).status).toBe(409)
        expect(await sessionUser(admin)).toMatchObject({ venueId: null, roles: [], venues: [] })
    })

    it('makes a user with two venues choose, and switches between them', async () => {
        await grant(ids.admin, 'checkout', 2)
        const admin = await loginAs(app, 'admin')
        expect(await sessionUser(admin)).toMatchObject({ venueId: null, roles: [] })
        expect((await admin.get('/api/menu')).status).toBe(409)

        const switched = await admin.put('/api/session/venue').send({ venueId: 2 })
        expect(switched.status).toBe(200)
        expect(switched.body).toMatchObject({ venueId: 2, roles: ['checkout'] })
        // The choice is kept in the session
        expect(await sessionUser(admin)).toMatchObject({ venueId: 2, roles: ['checkout'] })
        expect((await admin.get('/api/menu')).status).toBe(403)

        await admin.put('/api/session/venue').send({ venueId: 1 })
        expect((await admin.get('/api/menu')).status).toBe(200)
    })

    it('does not reveal venues the user cannot enter', async () => {
        const admin = await loginAs(app, 'admin')
        expect((await admin.put('/api/session/venue').send({ venueId: 2 })).status).toBe(404)
        expect((await admin.put('/api/session/venue').send({ venueId: 999 })).status).toBe(404)
        expect((await admin.put('/api/session/venue').send({ venueId: 'x' })).status).toBe(400)
        expect(await sessionUser(admin)).toMatchObject({ venueId: 1 })
    })

    it('leaves a venue that gets disabled', async () => {
        await grant(ids.admin, 'admin', 2)
        const admin = await loginAs(app, 'admin')
        await admin.put('/api/session/venue').send({ venueId: 2 })

        await sql(`UPDATE venues SET status = 'DISABLED' WHERE id = 2`)
        // Only venue 1 is left, so the user is moved there
        expect(await sessionUser(admin)).toMatchObject({ venueId: 1, venues: [{ id: 1, name: 'Chi Comanda', roles: ['admin'] }] })
    })

    it('lets the superuser enter every venue, with no role of its own there', async () => {
        const superuser = await loginAs(app, 'superuser')
        const user = await sessionUser(superuser)
        expect(user).toMatchObject({ superuser: true, venueId: null, roles: ['superuser'] })
        expect(user.venues.map((v: any) => v.id)).toEqual([1, 2])
        // Platform screens need no venue
        expect((await superuser.get('/api/users')).status).toBe(200)

        expect((await superuser.put('/api/session/venue').send({ venueId: 2 })).body)
            .toMatchObject({ venueId: 2, roles: ['superuser'] })
        expect((await superuser.get('/api/menu')).status).toBe(200)
    })

    it('treats the superuser role as global even when a previous release wrote it with a venue', async () => {
        await sql('UPDATE user_role SET venue_id = 1 WHERE user_id = ?', [ids.superuser])
        const user = await sessionUser(await loginAs(app, 'superuser'))
        expect(user).toMatchObject({ superuser: true })
        expect(user.venues.map((v: any) => v.id)).toEqual([1, 2])
    })

    it('ends the session of a user no longer active', async () => {
        const waiter = await loginAs(app, 'waiter')
        await sql(`UPDATE users SET status = 'DISABLED' WHERE id = ?`, [ids.waiter])
        expect(await sessionUser(waiter)).toBe(0)
        expect((await waiter.get('/api/events/ongoing')).status).toBe(401)
    })

    it('keeps only the user id in the session and reads sessions of earlier releases', async () => {
        const admin = await loginAs(app, 'admin')
        const [row] = await sql('SELECT session_id, data FROM sessions')
        const data = JSON.parse(row.data)
        expect(data.passport).toEqual({ user: ids.admin })
        expect(data.venueId).toBe(1)

        // Earlier releases stored the whole user, roles included: only the id is trusted
        delete data.venueId
        data.passport.user = { id: ids.admin, email: 'admin@test.local', roles: ['superuser'] }
        await sql('UPDATE sessions SET data = ? WHERE session_id = ?', [JSON.stringify(data), row.session_id])
        expect(await sessionUser(admin)).toMatchObject({ id: ids.admin, venueId: 1, roles: ['admin'], superuser: false })
    })

    it('shows the branding of the venue in the session, the platform one to anonymous users of several venues', async () => {
        await sql(`UPDATE venues SET name = 'Uno', logo = ? WHERE id = 1`, [Buffer.from('not used')])
        await sql(`UPDATE venues SET primary_color = '#112233' WHERE id = 2`)
        // Two venues: before login nobody knows which one
        expect((await request(app).get('/api/public/config')).body).toMatchObject({ name: null, logo: null })
        await request(app).get('/api/public/logo/512.png?venue=1&v=1').expect(404)

        await grant(ids.admin, 'admin', 2)
        const admin = await loginAs(app, 'admin')
        await admin.put('/api/session/venue').send({ venueId: 2 })
        expect((await admin.get('/api/public/config')).body).toMatchObject({ name: 'Secondo', colors: { primary: '#112233' } })
        // The admin edits the venue they work in, not the others
        await admin.put('/api/settings').send({ venue_name: 'Secondo bis' }).expect(200)
        expect((await sql('SELECT id, name FROM venues ORDER BY id'))).toEqual([{ id: 1, name: 'Uno' }, { id: 2, name: 'Secondo bis' }])
        // Another venue's logo is not served even when its id is in the URL
        await admin.get('/api/public/logo/512.png?venue=1&v=1').expect(404)
    })

    it('records the venue of an action in the audit, NULL for platform actions', async () => {
        const superuser = await loginAs(app, 'superuser')
        await superuser.put('/api/users/roles').send({ id: ids.client, roles: ['client'] })
        await superuser.put('/api/session/venue').send({ venueId: 2 })
        await superuser.post('/api/menu').send({ name: 'Nuovo' })

        expect(await sql('SELECT venue_id, path FROM audit ORDER BY id')).toEqual([
            { venue_id: null, path: '/users/roles' },
            { venue_id: 2, path: '/menu' },
        ])
    })
})
