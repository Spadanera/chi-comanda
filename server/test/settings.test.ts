import sharp from 'sharp'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FEATURES, parseFeatures } from '../src/features'
import { closeApp, loadApp, loginAs, resetDatabase } from './helpers'

let app: any
let admin: any

/** A 300x200 red PNG, to check the logo is squared to 512x512. */
const sampleImage = () => sharp({ create: { width: 300, height: 200, channels: 3, background: '#C00000' } }).png().toBuffer()

beforeAll(async () => {
    await resetDatabase()
    app = await loadApp()
    admin = await loginAs(app, 'admin')
})

afterAll(closeApp)

describe('FEATURES', () => {
    it('turns everything on when unset, so existing installations do not change', () => {
        expect([...parseFeatures(undefined)]).toEqual([...FEATURES])
    })

    it('turns everything off when empty', () => {
        expect(parseFeatures('').size).toBe(0)
    })

    it('reads a comma separated list', () => {
        expect([...parseFeatures(' push, payments ,')]).toEqual(['push', 'payments'])
    })

    it('refuses unknown names instead of silently switching a function off', () => {
        expect(() => parseFeatures('push,paymnets')).toThrow(/Unknown FEATURES: paymnets/)
    })
})

describe('public configuration', () => {
    it('with the default configuration has every function and no branding', async () => {
        const res = await request(app).get('/api/public/config').expect(200)
        expect(res.body).toEqual({
            name: null, slug: null, features: [...FEATURES], logo: null, colors: { primary: null, secondary: null }, sentry: null,
        })
    })

    it('serves the default manifest', async () => {
        const res = await request(app).get('/api/public/manifest.webmanifest').expect(200)
        expect(res.type).toBe('application/manifest+json')
        const manifest = JSON.parse(res.text)
        expect(manifest.name).toBe('Chi Comanda')
        expect(manifest.icons.map((i: any) => i.src)).toEqual(['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png'])
    })
})

describe('settings', () => {
    it('are reserved to admins', async () => {
        const waiter = await loginAs(app, 'waiter')
        await waiter.get('/api/settings').expect(403)
        await waiter.put('/api/settings').send({ venue_name: 'X' }).expect(403)
        await request(app).put('/api/settings').send({ venue_name: 'X' }).expect(401)
    })

    it('change name and colours shown to everybody', async () => {
        const res = await admin.put('/api/settings')
            .send({ venue_name: '  Libra  ', primary_color: '#aa3300', secondary_color: '' }).expect(200)
        expect(res.body).toEqual({ venue_name: 'Libra', primary_color: '#AA3300', secondary_color: null, has_logo: false })

        const config = (await request(app).get('/api/public/config').expect(200)).body
        expect(config).toMatchObject({ name: 'Libra', colors: { primary: '#AA3300', secondary: null } })
        expect(JSON.parse((await request(app).get('/api/public/manifest.webmanifest')).text).short_name).toBe('Libra')
    })

    it('reject invalid colours and names', async () => {
        await admin.put('/api/settings').send({ primary_color: 'red' }).expect(400)
        await admin.put('/api/settings').send({ venue_name: 'x'.repeat(101) }).expect(400)
    })

    it('store the logo as a square PNG in every size the manifest needs', async () => {
        await admin.put('/api/settings/logo').attach('logo', Buffer.from('not an image'), 'logo.png').expect(400)
        const res = await admin.put('/api/settings/logo').attach('logo', await sampleImage(), 'logo.png').expect(200)
        expect(res.body.has_logo).toBe(true)

        const config = (await request(app).get('/api/public/config').expect(200)).body
        expect(config.logo).toMatch(/^\/api\/public\/logo\/512\.png\?venue=1&v=\d+$/)

        for (const [size, pixels] of [['512', 512], ['192', 192], ['maskable', 512]] as const) {
            const png = await request(app).get(`/api/public/logo/${size}.png?v=1`)
                .buffer(true).parse((r, cb) => { const chunks: Buffer[] = []; r.on('data', (c: Buffer) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))) })
                .expect(200)
            expect(png.headers['cache-control']).toContain('immutable')
            const meta = await sharp(png.body).metadata()
            expect([meta.format, meta.width, meta.height]).toEqual(['png', pixels, pixels])
        }
        await request(app).get('/api/public/logo/1024.png').expect(404)

        const manifest = JSON.parse((await request(app).get('/api/public/manifest.webmanifest')).text)
        expect(manifest.icons.map((i: any) => i.src)).toEqual([
            expect.stringMatching(/^\/api\/public\/logo\/192\.png\?venue=1&v=/),
            expect.stringMatching(/^\/api\/public\/logo\/512\.png\?venue=1&v=/),
            expect.stringMatching(/^\/api\/public\/logo\/maskable\.png\?venue=1&v=/),
        ])
    })

    it('go back to the default logo', async () => {
        await admin.delete('/api/settings/logo').expect(200)
        expect((await request(app).get('/api/public/config')).body.logo).toBeNull()
        await request(app).get('/api/public/logo/512.png').expect(404)
    })
})
