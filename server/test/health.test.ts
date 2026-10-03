import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { listMigrations } from '../src/db/migrate'
import { closeApp, loadApp, rawConnection, resetDatabase } from './helpers'
import rootPackage from '../../package.json'

let app: any

async function sessionCount(): Promise<number> {
    const conn = await rawConnection()
    const [[row]]: any = await conn.query('SELECT COUNT(*) n FROM sessions')
    await conn.end()
    return row.n
}

beforeAll(async () => {
    await resetDatabase()
    app = await loadApp()
})

afterAll(closeApp)

describe('GET /api/health', () => {
    it('reports version and last migration, without a session', async () => {
        const migrations = await listMigrations()
        const res = await request(app).get('/api/health').expect(200)
        expect(res.body).toEqual({
            status: 'ok', version: rootPackage.version, commit: null, client: null,
            db: 'ok', migration: migrations[migrations.length - 1].name,
        })
        expect(res.headers['cache-control']).toBe('no-store')
        expect(res.headers['set-cookie']).toBeUndefined()
        expect(await sessionCount()).toBe(0)
    })

    it('answers 503 when the database is unreachable, so the platform keeps the previous deploy', async () => {
        const { default: db } = await import('../src/db')
        vi.spyOn(db, 'queryOne').mockRejectedValueOnce(new Error('connect ETIMEDOUT'))
        const res = await request(app).get('/api/health').expect(503)
        expect(res.body).toMatchObject({ status: 'error', db: 'unreachable', migration: null })
    })
})
