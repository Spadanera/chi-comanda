import crypto from 'crypto'
import { Request } from 'express'
import idempotencyService from '../services/idempotency'
import { ctx, VenueContext } from '../venue/context'
import { asyncHandler } from './middleware'
import { BadRequestError } from './errors'

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Like `jsonHandler`, for operations a client may send twice on an unstable network (orders, table closing, payments).
 * With an `Idempotency-Key` header (a UUID) the operation runs once per key in the venue: a retry gets the stored
 * answer, with `Idempotent-Replayed: true`. `fn` must work only through the context it gets (it runs in the key's
 * transaction). Without the header it runs as before (older clients).
 */
export const idempotentHandler = (fn: (req: Request, ctx: VenueContext) => Promise<unknown>) =>
    asyncHandler(async (req, res) => {
        const context = ctx(req)
        const key = req.get(IDEMPOTENCY_HEADER)
        if (key === undefined) {
            res.status(200).json(await fn(req, context))
            return
        }
        if (!UUID.test(key)) throw new BadRequestError(`${IDEMPOTENCY_HEADER} non valida`)
        const outcome = await idempotencyService.run(context, {
            key: key.toLowerCase(),
            scope: `${req.method} ${req.baseUrl}${req.path}`.replace(' /api/', ' /').replace(/\/$/, ''),
            hash: crypto.createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex'),
        }, tx => fn(req, tx))
        if (outcome.replayed) res.set('Idempotent-Replayed', 'true')
        res.status(outcome.status).json(outcome.body)
    })
