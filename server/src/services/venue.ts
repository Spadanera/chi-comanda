import db from '../db'

/** Branding columns of a venue; NULL = the default. */
export interface VenueBrandingRow {
    id: number
    name: string | null
    primary_color: string | null
    secondary_color: string | null
    has_logo: number
    version: number
}

/** Platform-level lookups on venues, outside any venue context. */
class VenueService {
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
