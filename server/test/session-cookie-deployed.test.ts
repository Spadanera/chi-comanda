import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { closeApp, loadApp, PASSWORD, resetDatabase, ROLE_USERS } from './helpers'

/** A deployed installation behind Railway's proxy (RAILWAY_ENVIRONMENT is set on every Railway deploy). */

let app: any

beforeAll(async () => {
    // Read when the app is loaded (each test file has its own modules)
    vi.stubEnv('RAILWAY_ENVIRONMENT', 'staging')
    await resetDatabase()
    app = await loadApp()
})

afterAll(async () => {
    vi.unstubAllEnvs()
    await closeApp()
})

const login = () => request(app).post('/api/login').send({ email: ROLE_USERS.admin, password: PASSWORD })

describe('session cookie (deployed)', () => {
    it('is Secure when the proxy says the request came over https', async () => {
        const res = await login().set('X-Forwarded-Proto', 'https').expect(200)
        const [cookie] = res.headers['set-cookie'] as unknown as string[]
        expect(cookie).toMatch(/^lp-session=/)
        expect(cookie).toContain('Secure')
        expect(cookie).toContain('HttpOnly')
        expect(cookie).toContain('SameSite=Lax')
        expect(cookie).not.toMatch(/Domain=/i)
    })

    it('is never sent over plain http', async () => {
        const res = await login().set('X-Forwarded-Proto', 'http')
        expect(res.headers['set-cookie']).toBeUndefined()
    })
})
