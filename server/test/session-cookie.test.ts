import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configErrors } from '../src/config'
import { closeApp, loadApp, PASSWORD, resetDatabase, ROLE_USERS } from './helpers'

/** Local development: same cookie rules except `Secure`, so the app works over plain http. */

let app: any

beforeAll(async () => {
    await resetDatabase()
    app = await loadApp()
})

afterAll(closeApp)

describe('session cookie (local)', () => {
    it('is httpOnly, SameSite=Lax, bound to this host and not Secure over http', async () => {
        const res = await request(app).post('/api/login').send({ email: ROLE_USERS.admin, password: PASSWORD }).expect(200)
        const [cookie] = res.headers['set-cookie'] as unknown as string[]
        expect(cookie).toMatch(/^lp-session=/)
        expect(cookie).toContain('HttpOnly')
        expect(cookie).toContain('SameSite=Lax')
        expect(cookie).not.toMatch(/Domain=/i)
        expect(cookie).not.toContain('Secure')
    })
})

describe('required configuration', () => {
    const ok = { deployed: true, sessionSecret: 's3cret', baseUrl: 'https://libra.chicomanda.com' }

    it('is not enforced in local development', () => {
        expect(configErrors({ deployed: false, sessionSecret: '', baseUrl: '' })).toEqual([])
    })

    it('stops a deployed installation without SECRET or BASE_URL', () => {
        expect(configErrors(ok)).toEqual([])
        expect(configErrors({ ...ok, sessionSecret: '' })).toEqual([expect.stringMatching(/^SECRET is not set/)])
        expect(configErrors({ ...ok, baseUrl: '' })).toEqual([expect.stringMatching(/^BASE_URL is not set/)])
        expect(configErrors({ ...ok, baseUrl: 'libra.chicomanda.com' })).toEqual([expect.stringMatching(/^BASE_URL is not a URL/)])
    })
})
