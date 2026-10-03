import db from '../db'

/** Platform-level lookups on venues, outside any venue context. */
class VenueService {
    /**
     * Venue of a payment transaction, for the public POS callback: the request carries only the (signed) transaction
     * id, so the venue comes from the stored row, never from the request.
     */
    async venueOfPaymentTransaction(transactionId: number): Promise<number | undefined> {
        return (await db.queryOne<{ venue_id: number }>('SELECT venue_id FROM payment_transactions WHERE id = ?', [transactionId]))?.venue_id
    }
}

export default new VenueService()
