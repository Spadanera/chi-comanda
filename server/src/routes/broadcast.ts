import { Router } from 'express'
import broadcastService from '../services/broadcast'
import { currentUserId, jsonHandler } from '../http/middleware'
import { ForbiddenError } from '../http/errors'

const router = Router()

/** Staff-to-staff messages; the sender must be the logged user. */
router.post('/', jsonHandler(req => {
    if (Number(req.body.sender?.id) !== currentUserId(req)) {
        throw new ForbiddenError()
    }
    return broadcastService.broadcastMessage(req.body)
}))

export default router
