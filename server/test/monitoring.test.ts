import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/node'
import { closeApp, loadApp, resetDatabase, ROLE_USERS, PASSWORD } from './helpers'

vi.mock('@sentry/node', () => ({ init: vi.fn(), captureException: vi.fn(), flush: vi.fn() }))

let app: any

beforeAll(async () => {
    // Read when the app is loaded (each test file has its own modules)
    vi.stubEnv('SENTRY_DSN', 'https://server@sentry.example/1')
    vi.stubEnv('SENTRY_CLIENT_DSN', 'https://client@sentry.example/2')
    vi.stubEnv('SENTRY_ENVIRONMENT', 'staging')
    vi.stubEnv('CLIENT_SLUG', 'libra')
    await resetDatabase()
    app = await loadApp()
    const { initMonitoring } = await import('../src/monitoring')
    initMonitoring()
})

afterAll(async () => {
    vi.unstubAllEnvs()
    await closeApp()
})

describe('Sentry', () => {
    it('is initialised with the client tag and without personal data', () => {
        expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
            dsn: 'https://server@sentry.example/1',
            environment: 'staging',
            sendDefaultPii: false,
            initialScope: { tags: { client: 'libra' } },
        }))
    })

    it('receives server errors, not client mistakes', async () => {
        await request(app).post('/api/login').send({ email: ROLE_USERS.admin, password: 'wrong' }).expect(401)
        expect(Sentry.captureException).not.toHaveBeenCalled()

        const { default: db } = await import('../src/db')
        vi.spyOn(db, 'queryOne').mockRejectedValueOnce(new Error('connect ETIMEDOUT'))
        await request(app).post('/api/login').send({ email: ROLE_USERS.admin, password: PASSWORD }).expect(500)
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'connect ETIMEDOUT' }))
    })

    it('gives the browser its own DSN through the public configuration', async () => {
        const res = await request(app).get('/api/public/config').expect(200)
        expect(res.body.sentry).toEqual({ dsn: 'https://client@sentry.example/2', environment: 'staging', release: expect.any(String) })
    })
})
