import db from '../db'
import config from '../config'
import { Feature, parseFeatures } from '../features'
import { BadRequestError, NotFoundError } from '../http/errors'

/** Branding columns of a venue; NULL = the default. */
export interface VenueBrandingRow {
    id: number
    name: string | null
    primary_color: string | null
    secondary_color: string | null
    has_logo: number
    version: number
}

/** A venue as the platform's superuser manages it. */
export interface VenueSummary {
    id: number
    name: string
    status: 'ACTIVE' | 'DISABLED'
    /** `null` = every feature of the installation. */
    features: Feature[] | null
    members: number
}

/** Catalogue every new venue starts with (the same as the baseline seed of the first one). */
const DEFAULT_TYPES: { name: string, icon: string, subTypes: [string, string][] }[] = [
    {
        name: 'Bevanda', icon: 'mdi-beer', subTypes: [
            ['Birra alla spina', 'mdi-glass-mug-variant'], ['Birra in bottiglia', 'mdi-bottle-wine'], ['Cocktail', 'mdi-glass-cocktail'],
            ['Analcolico', 'mdi-bottle-soda'], ['Extra', 'mdi-glass-wine'],
        ],
    },
    { name: 'Cibo', icon: 'mdi-hamburger', subTypes: [['Special', 'mdi-french-fries'], ['Piadina', 'mdi-taco'], ['Panino', 'mdi-food-hot-dog']] },
]

function toName(value: unknown): string {
    const name = typeof value === 'string' ? value.trim() : ''
    if (!name || name.length > 100) {
        throw new BadRequestError('Nome del locale non valido (da 1 a 100 caratteri)')
    }
    return name
}

/** `null` keeps every feature of the installation; otherwise a subset of FEATURES (unknown names are refused). */
function toFeatures(value: unknown): Feature[] | null {
    if (value === null || value === undefined) return null
    if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
        throw new BadRequestError('Funzioni non valide')
    }
    try {
        return [...parseFeatures(value.join(','))]
    } catch (error: any) {
        throw new BadRequestError(error.message)
    }
}

/** Venues of the installation (platform level, outside any venue context). */
class VenueService {
    async getAll(): Promise<VenueSummary[]> {
        const rows = await db.query<VenueSummary & { name: string | null, features: any }>(`
            SELECT id, name, status, features,
                (SELECT COUNT(DISTINCT user_id) FROM user_role WHERE user_role.venue_id = venues.id) members
            FROM venues ORDER BY name, id`)
        return rows.map(r => ({
            ...r,
            name: r.name || config.client.name || 'Chi Comanda',
            features: typeof r.features === 'string' ? JSON.parse(r.features) : r.features,
            members: Number(r.members),
        }))
    }

    /** A new venue, with the default catalogue and an empty main menu. */
    async create(input: { name?: unknown, features?: unknown }): Promise<number> {
        const name = toName(input.name)
        const features = toFeatures(input.features)
        return db.transaction(async tx => {
            const venueId = await tx.insert('INSERT INTO venues (name, features) VALUES (?, ?)',
                [name, features === null ? null : JSON.stringify(features)])
            await tx.insert(`INSERT INTO menu (venue_id, name, creation_date, status) VALUES (?, 'Menu Principale', NOW(), 'ACTIVE')`, [venueId])
            for (const type of DEFAULT_TYPES) {
                const typeId = await tx.insert('INSERT INTO types (venue_id, name, icon) VALUES (?, ?, ?)', [venueId, type.name, type.icon])
                for (const [subName, icon] of type.subTypes) {
                    await tx.insert('INSERT INTO sub_types (venue_id, name, type_id, icon) VALUES (?, ?, ?, ?)', [venueId, subName, typeId, icon])
                }
            }
            return venueId
        })
    }

    /** Renames, (re)enables/disables a venue or changes its features. A disabled venue disappears for its staff. */
    async update(id: number, input: { name?: unknown, status?: unknown, features?: unknown }): Promise<void> {
        const venue = await db.queryOne('SELECT id FROM venues WHERE id = ?', [id])
        if (!venue) throw new NotFoundError()
        if (input.name !== undefined) {
            await db.execute('UPDATE venues SET name = ? WHERE id = ?', [toName(input.name), id])
        }
        if (input.status !== undefined) {
            if (!['ACTIVE', 'DISABLED'].includes(String(input.status))) throw new BadRequestError('Stato non valido')
            await db.execute('UPDATE venues SET status = ? WHERE id = ?', [input.status, id])
        }
        if (input.features !== undefined) {
            const features = toFeatures(input.features)
            await db.execute('UPDATE venues SET features = ? WHERE id = ?', [features === null ? null : JSON.stringify(features), id])
        }
    }

    /** The installation's only active venue, when it has exactly one. */
    async singleActiveVenue(): Promise<number | undefined> {
        const rows = await db.query<{ id: number }>(`SELECT id FROM venues WHERE status = 'ACTIVE' LIMIT 2`)
        return rows.length === 1 ? rows[0].id : undefined
    }

    branding(venueId: number): Promise<VenueBrandingRow | undefined> {
        return db.queryOne<VenueBrandingRow>(`
            SELECT id, name, primary_color, secondary_color, logo IS NOT NULL has_logo, UNIX_TIMESTAMP(updated_at) version
            FROM venues WHERE id = ? AND status = 'ACTIVE'`, [venueId])
    }

    async logo(venueId: number): Promise<Buffer | undefined> {
        return (await db.queryOne<{ logo: Buffer | null }>(`SELECT logo FROM venues WHERE id = ? AND status = 'ACTIVE'`, [venueId]))?.logo
            ?? undefined
    }

    /**
     * Venue of a payment transaction, for the public POS callback: the request carries only the (signed) transaction
     * id, so the venue comes from the stored row, never from the request.
     */
    async venueOfPaymentTransaction(transactionId: number): Promise<number | undefined> {
        return (await db.queryOne<{ venue_id: number }>('SELECT venue_id FROM payment_transactions WHERE id = ?', [transactionId]))?.venue_id
    }
}

export default new VenueService()
