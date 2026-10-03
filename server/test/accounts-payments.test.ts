import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { closeApp, loadApp, loginAs, openEvent, openTable, rawConnection, resetDatabase, RoleName } from './helpers'

let app: any
let users: Record<RoleName, number>

beforeAll(async () => {
    users = await resetDatabase()
    app = await loadApp()
})

afterAll(closeApp)

async function queryOne(sql: string, params: any[] = []) {
    const conn = await rawConnection()
    try {
        const [rows]: any = await conn.query(sql, params)
        return rows[0]
    } finally {
        await conn.end()
    }
}

describe('invitations and password reset', () => {
    it('accepts an invitation once and burns the token', async () => {
        const superuser = await loginAs(app, 'superuser')
        await superuser.post('/api/users/invite').send({ email: 'new@test.local', roles: ['waiter'] }).expect(200)
        const { token } = await queryOne('SELECT token FROM users WHERE email = ?', ['new@test.local'])
        expect(token).toBeTruthy()

        await request(app).post('/public/invitation/accept')
            .field('token', token).field('username', 'newbie').field('password', 'Secret123!')
            .expect(200)

        const login = await request(app).post('/api/login').send({ email: 'new@test.local', password: 'Secret123!' })
        expect(login.status).toBe(200)
        expect(login.body.roles).toEqual(['waiter'])

        const replay = await request(app).post('/public/invitation/accept')
            .field('token', token).field('username', 'attacker').field('password', 'Hijacked1!')
        expect(replay.status).toBe(400)
    })

    it('rejects an invitation with no roles gracefully', async () => {
        const superuser = await loginAs(app, 'superuser')
        const res = await superuser.post('/api/users/invite').send({ email: 'noroles@test.local', roles: [] })
        expect(res.status).toBe(200)
    })

    it('re-sends a pending invitation on the same user with a fresh token', async () => {
        const { default: sendEmail } = await import('../src/utils/mail')
        const superuser = await loginAs(app, 'superuser')
        await superuser.post('/api/users/invite').send({ email: 'twice@test.local', roles: ['waiter'] }).expect(200)
        const first = await queryOne('SELECT id, token FROM users WHERE email = ?', ['twice@test.local'])

        vi.mocked(sendEmail).mockClear()
        await superuser.post('/api/users/invite').send({ email: 'twice@test.local', roles: ['bartender'] }).expect(200)

        const { count } = await queryOne('SELECT COUNT(*) AS count FROM users WHERE email = ?', ['twice@test.local'])
        expect(count).toBe(1)
        const second = await queryOne('SELECT id, token FROM users WHERE email = ?', ['twice@test.local'])
        expect(second.id).toBe(first.id)
        expect(second.token).not.toBe(first.token)
        expect(vi.mocked(sendEmail)).toHaveBeenCalledOnce()
        expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain(`/invitation/${second.token}`)
        const { roles } = await queryOne(`
            SELECT GROUP_CONCAT(roles.name) AS roles FROM user_role
            INNER JOIN roles ON roles.id = user_role.role_id WHERE user_id = ?`, [second.id])
        expect(roles).toBe('bartender')

        // The superseded link no longer works
        const stale = await request(app).post('/public/invitation/accept')
            .field('token', first.token).field('username', 'old').field('password', 'Secret123!')
        expect(stale.status).toBe(400)
    })

    it('refuses to invite an e-mail that already has an account', async () => {
        const superuser = await loginAs(app, 'superuser')
        const res = await superuser.post('/api/users/invite').send({ email: 'waiter@test.local', roles: ['waiter'] })
        expect(res.status).toBe(400)
        expect(res.body.message).toBe('Utente già esistente')
    })

    it('links a Google sign-in to the pending invitation with the same e-mail', async () => {
        const superuser = await loginAs(app, 'superuser')
        await superuser.post('/api/users/invite').send({ email: 'google@test.local', roles: ['waiter'] }).expect(200)
        const invited = await queryOne('SELECT id FROM users WHERE email = ?', ['google@test.local'])

        const { default: userService } = await import('../src/services/user')
        const user = await userService.findOrCreateGoogleUser('google-123', 'google@test.local', 'Gigi', 'avatar.png')

        expect(user).toMatchObject({ id: invited.id, email: 'google@test.local', username: 'Gigi', roles: ['waiter'] })
        const { count } = await queryOne('SELECT COUNT(*) AS count FROM users WHERE email = ?', ['google@test.local'])
        expect(count).toBe(1)
        expect(await queryOne('SELECT status, token, googleId FROM users WHERE id = ?', [invited.id]))
            .toEqual({ status: 'ACTIVE', token: null, googleId: 'google-123' })
    })

    it('sends no reset link to a pending invitation', async () => {
        const superuser = await loginAs(app, 'superuser')
        await superuser.post('/api/users/invite').send({ email: 'pending@test.local', roles: ['waiter'] }).expect(200)
        await request(app).post('/public/askreset').send({ email: 'pending@test.local' }).expect(200)
        expect(await queryOne('SELECT id FROM reset WHERE email = ?', ['pending@test.local'])).toBeUndefined()
    })

    it('resets a password with a fresh token and rejects expired ones', async () => {
        await request(app).post('/public/askreset').send({ email: 'client@test.local' }).expect(200)
        const { token } = await queryOne('SELECT token FROM reset WHERE email = ? ORDER BY id DESC', ['client@test.local'])
        await request(app).post('/public/reset').send({ token, password: 'Changed123!' }).expect(200)
        expect((await request(app).post('/api/login').send({ email: 'client@test.local', password: 'Changed123!' })).status).toBe(200)

        const conn = await rawConnection()
        await conn.query(`INSERT INTO reset (email, token, creation_date) VALUES ('client@test.local', 'old-token', NOW() - INTERVAL 2 DAY)`)
        await conn.end()
        const expired = await request(app).post('/public/reset').send({ token: 'old-token', password: 'Nope12345!' })
        expect(expired.status).toBe(400)
    })
})

describe('payments', () => {
    it('stores provider settings without ever returning secrets', async () => {
        const admin = await loginAs(app, 'admin')
        await admin.post('/api/payment/settings').send({
            provider: 'sumup_pos', enabled: true,
            config: { affiliate_key: 'aff-secret', server_url: 'https://example.test', currency: 'EUR' },
        }).expect(200)

        const settings = await admin.get('/api/payment/settings')
        expect(settings.body).toEqual([{ id: expect.any(Number), provider: 'sumup_pos', enabled: true, configured: true }])
        expect(JSON.stringify(settings.body)).not.toContain('aff-secret')

        const checkout = await loginAs(app, 'checkout')
        const available = await checkout.get('/api/payment/available')
        expect(available.body).toEqual([{ provider: 'sumup_pos', enabled: true }])
    })

    it('creates a POS session and only accepts a correctly signed callback', async () => {
        const eventId = await openEvent(app, users)
        const table = await openTable(app, eventId)
        const checkout = await loginAs(app, 'checkout')
        const session = await checkout.post('/api/payment/checkout/sumup-pos').send({
            table_id: table.tableId, event_id: eventId, amount: table.total, item_ids: [],
        })
        expect(session.status).toBe(200)
        expect(session.body.url_scheme).toMatch(/^sumupmerchant:\/\/pay\?/)
        const callback = new URL(decodeURIComponent(session.body.url_scheme.match(/callback=([^&]+)/)[1]))
        expect(callback.searchParams.get('tx_id')).toBe(String(session.body.id))

        const forged = await request(app).get('/api/public/payment/sumup/pos-callback')
            .query({ tx_id: session.body.id, 'smp-status': 'success' })
        expect(forged.status).toBe(403)
        expect((await queryOne('SELECT status FROM payment_transactions WHERE id = ?', [session.body.id])).status).toBe('PENDING')

        const genuine = await request(app).get('/api/public/payment/sumup/pos-callback')
            .query({ ...Object.fromEntries(callback.searchParams), 'smp-status': 'success', 'smp-tx-code': 'TX123' })
        expect(genuine.status).toBe(200)
        expect(await queryOne('SELECT status, external_id FROM payment_transactions WHERE id = ?', [session.body.id]))
            .toEqual({ status: 'PAID', external_id: 'TX123' })
    })

    it('validates payment payloads', async () => {
        const checkout = await loginAs(app, 'checkout')
        const res = await checkout.post('/api/payment/checkout/sumup-pos').send({ table_id: 'x', amount: -1 })
        expect(res.status).toBe(400)
    })
})
