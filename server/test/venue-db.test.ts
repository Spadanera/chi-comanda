import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeApp, rawConnection, resetDatabase } from './helpers'
import { VenueDb } from '../src/venue/db'
import { NotFoundError } from '../src/http/errors'

let menuOf2: number

beforeAll(async () => {
    await resetDatabase()
    const conn = await rawConnection()
    await conn.query(`INSERT INTO venues (id, name) VALUES (2, 'Secondo')`)
    const [res]: any = await conn.query(`INSERT INTO menu (venue_id, name, status) VALUES (2, 'Menu B', 'ACTIVE')`)
    menuOf2 = res.insertId
    await conn.end()
})

afterAll(async () => {
    await resetDatabase()
    await closeApp()
})

describe('VenueDb', () => {
    const venue1 = new VenueDb(1)

    it('binds :venue to its own venue', async () => {
        const rows = await venue1.query('SELECT venue_id FROM menu WHERE venue_id = :venue')
        expect(rows.length).toBeGreaterThan(0)
        expect(rows.every(r => r.venue_id === 1)).toBe(true)
        expect(await new VenueDb(2).query('SELECT id FROM menu WHERE venue_id = :venue')).toEqual([{ id: menuOf2 }])
    })

    it('treats a row of another venue as missing', async () => {
        await expect(venue1.find('menu', menuOf2)).rejects.toBeInstanceOf(NotFoundError)
        await expect(venue1.ensure('menu', [1, menuOf2])).rejects.toBeInstanceOf(NotFoundError)
        await expect(venue1.executeOne('UPDATE menu SET name = ? WHERE venue_id = :venue AND id = ?', ['x', menuOf2]))
            .rejects.toBeInstanceOf(NotFoundError)
        await venue1.ensure('menu', [1, 1, null, undefined])
    })

    it('counts a matched row as affected even when nothing changes', async () => {
        const { name } = await venue1.find('menu', 1, 'name')
        expect(await venue1.executeOne('UPDATE menu SET name = ? WHERE venue_id = :venue AND id = ?', [name, 1])).toBe(1)
    })

    it('refuses a query that forgets the venue, before running it', async () => {
        await expect(venue1.execute(`UPDATE menu SET name = 'x'`)).rejects.toThrow(/:venue/)
        expect((await venue1.find('menu', 1, 'name')).name).not.toBe('x')
    })

    it('rejects an invalid venue id', () => {
        expect(() => new VenueDb(0)).toThrow()
        expect(() => new VenueDb(NaN)).toThrow()
    })
})
