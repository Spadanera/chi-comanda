import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import passport from 'passport'
import { Strategy } from 'passport-strategy'
import { closeApp, loadApp, resetDatabase, RoleName } from './helpers'
import { safeRedirect } from '../src/routes/auth-router'

let app: any
let ids: Record<RoleName, number>

/** Stands in for Google on the way back: signs in the given user. */
class FakeGoogle extends Strategy {
    constructor(private userId: number) { super() }
    authenticate() {
        this.success({ id: this.userId })
    }
}

beforeAll(async () => {
    ids = await resetDatabase()
    app = await loadApp()
})

afterAll(closeApp)

describe('Google login', () => {
    it('opens the page asked before the login, e.g. the venue of an e-mail link', async () => {
        const agent = request.agent(app)
        const toGoogle = await agent.get('/api/auth/google').query({ redirect: '/?venue=1' }).expect(302)
        expect(toGoogle.headers.location).toMatch(/^https:\/\/accounts\.google\.com\//)

        passport.use('google', new FakeGoogle(ids.waiter))
        const back = await agent.get('/api/auth/google/callback').expect(302)
        expect(back.headers.location).toBe('/?venue=1')
        // Logged in, and the page is forgotten: the next login goes home
        expect((await agent.get('/api/checkauthentication')).body).toMatchObject({ id: ids.waiter })
        await agent.post('/api/logout')
        expect((await agent.get('/api/auth/google/callback').expect(302)).headers.location).toBe('/')
    })

    it('never sends to another site', () => {
        expect(safeRedirect('/admin/users?x=1')).toBe('/admin/users?x=1')
        for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'admin', undefined, ['/'], `/${'a'.repeat(600)}`]) {
            expect(safeRedirect(bad)).toBeUndefined()
        }
    })
})
