import { Router } from 'express'
import broadcastService from '../services/broadcast'
import { currentUserId, jsonHandler } from '../http/middleware'
import { ForbiddenError } from '../http/errors'
import { ctx } from '../venue/context'

const router = Router()

/** Staff-to-staff messages; the sender must be the logged user. */
router.post('/', jsonHandler(req => {
    if (Number(req.body.sender?.id) !== currentUserId(req)) {
        throw new ForbiddenError()
    }
    return broadcastService.broadcastMessage(ctx(req), req.body)
}))

export default router
