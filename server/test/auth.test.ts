import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { closeApp, loadApp, loginAs, PASSWORD, resetDatabase, ROLE_USERS } from './helpers'

let app: any

beforeAll(async () => {
    await resetDatabase()
    app = await loadApp()
})

afterAll(closeApp)

describe('authentication', () => {
    it('logs in with valid credentials and returns the user without password', async () => {
        const res = await request(app).post('/api/login').send({ email: ROLE_USERS.admin, password: PASSWORD })
        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({ email: ROLE_USERS.admin, roles: ['admin'] })
        expect(res.body.password).toBeUndefined()
    })

    it('rejects invalid credentials', async () => {
        const res = await request(app).post('/api/login').send({ email: ROLE_USERS.admin, password: 'wrong' })
        expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('does not report a database failure as wrong credentials', async () => {
        const { default: db } = await import('../src/db')
        const spy = vi.spyOn(db, 'queryOne').mockRejectedValueOnce(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }))
        const res = await request(app).post('/api/login').send({ email: ROLE_USERS.admin, password: PASSWORD })
        spy.mockRestore()
        expect(res.status).toBe(500)
        expect(res.body).toEqual({ message: 'Internal server error' })
    })

    it('reports authentication state', async () => {
        expect((await request(app).get('/api/checkauthentication')).body).toBe(0)
        const agent = await loginAs(app, 'waiter')
        const res = await agent.get('/api/checkauthentication')
        expect(res.body).toMatchObject({ email: ROLE_USERS.waiter })
    })

    it('blocks anonymous access to the private api', async () => {
        const res = await request(app).get('/api/events/ongoing')
        expect(res.status).toBe(401)
    })

    it('invalidates the server-side session on logout', async () => {
        const agent = await loginAs(app, 'waiter')
        const cookie = (await agent.get('/api/checkauthentication')).request.cookies
        await agent.post('/api/logout').expect(200)
        // Replaying the old session cookie must not be accepted any more
        const replay = await request(app).get('/api/events/ongoing').set('Cookie', cookie)
        expect(replay.status).toBe(401)
    })
})

describe('authorization', () => {
    it('forbids non-superusers from user management', async () => {
        const agent = await loginAs(app, 'admin')
        const res = await agent.get('/api/users')
        expect(res.status).toBe(403)
    })

    it('lets superuser access everything', async () => {
        const agent = await loginAs(app, 'superuser')
        expect((await agent.get('/api/users')).status).toBe(200)
        expect((await agent.get('/api/menu')).status).toBe(200)
    })

    it('forbids users without operational roles from reading tables', async () => {
        const agent = await loginAs(app, 'client')
        expect((await agent.get('/api/tables/1')).status).toBe(403)
        expect((await agent.get('/api/events/1/tables')).status).toBe(403)
    })
})
