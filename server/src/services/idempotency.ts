import { HttpError } from '../http/errors'
import { inTransaction, VenueContext } from '../venue/context'

/** How long a key is remembered: longer than any order waits in a client's offline queue. */
const RETENTION_DAYS = 30

export interface IdempotentRequest {
    key: string
    /** Method and path, e.g. `PUT /tables/12/complete`. */
    scope: string
    /** SHA-256 of the body. */
    hash: string
}

export interface IdempotentOutcome {
    status: number
    body: unknown
    /** True when the answer is the one stored by an earlier request with the same key. */
    replayed: boolean
}

interface StoredKey {
    user_id: number | null
    scope: string
    request_hash: string
    response_status: number
    response_body: unknown
}

/** The key is in the venue already: committed by an earlier request (or by a concurrent one, waited for). */
class KeyTaken extends Error { }

class IdempotencyService {
    /**
     * Runs `work` once per key in the venue. The key is inserted first, in the same transaction as the operation and
     * its answer: either both are committed or neither (an error frees the key for a retry). A concurrent request with
     * the same key waits on the unique index until the first one ends, then gets its answer.
     */
    async run(ctx: VenueContext, request: IdempotentRequest, work: (tx: VenueContext) => Promise<unknown>): Promise<IdempotentOutcome> {
        try {
            const body = await inTransaction(ctx, async tx => {
                // IGNORE: a taken key inserts nothing (after waiting for a concurrent request holding it)
                const inserted = await tx.db.execute(`
                    INSERT IGNORE INTO idempotency_keys (venue_id, idem_key, user_id, scope, request_hash, response_status)
                    VALUES (:venue, ?, ?, ?, ?, 200)`, [request.key, ctx.userId, request.scope, request.hash])
                if (!inserted) throw new KeyTaken()
                const result = await work(tx)
                await tx.db.execute('UPDATE idempotency_keys SET response_body = ? WHERE venue_id = :venue AND idem_key = ?',
                    [JSON.stringify(result ?? null), request.key])
                return result
            })
            void this.purge(ctx)
            return { status: 200, body, replayed: false }
        } catch (error) {
            if (!(error instanceof KeyTaken)) throw error
            return this.replay(ctx, request)
        }
    }

    private async replay(ctx: VenueContext, request: IdempotentRequest): Promise<IdempotentOutcome> {
        const stored = await ctx.db.queryOne<StoredKey>(`
            SELECT user_id, scope, request_hash, response_status, response_body
            FROM idempotency_keys WHERE venue_id = :venue AND idem_key = ?`, [request.key])
        // Another request under the same key (or somebody else's): refused, without telling what it was
        if (!stored || stored.user_id !== ctx.userId || stored.scope !== request.scope || stored.request_hash !== request.hash) {
            throw new HttpError(422, 'Chiave di idempotenza già usata per un\'altra richiesta')
        }
        return { status: stored.response_status, body: stored.response_body, replayed: true }
    }

    /** Forgets the venue's old keys, a few at a time. */
    private async purge(ctx: VenueContext) {
        try {
            await ctx.db.execute(`DELETE FROM idempotency_keys WHERE venue_id = :venue AND created_at < NOW() - INTERVAL ${RETENTION_DAYS} DAY LIMIT 500`)
        } catch (error) {
            console.error('Purging idempotency keys failed', error)
        }
    }
}

export default new IdempotencyService()
