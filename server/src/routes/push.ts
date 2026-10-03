import { Router } from 'express'
import pushService, { PushSubscriptionInput } from '../services/push'
import { jsonHandler, requireRole, Roles } from '../http/middleware'
import { ctx } from '../venue/context'
import { BadRequestError } from '../http/errors'

function toSubscription(body: any): PushSubscriptionInput {
    const endpoint = body?.endpoint, keys = body?.keys
    const isText = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max
    if (!isText(endpoint, 512) || !/^https:\/\//.test(endpoint) || !isText(keys?.p256dh, 255) || !isText(keys?.auth, 255)) {
        throw new BadRequestError('Iscrizione alle notifiche non valida')
    }
    return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}

const router = Router()
const bartender = requireRole(Roles.bartender)

/** Whether push is configured on the server, and the VAPID public key the browser needs. */
router.get('/config', jsonHandler(async req => pushService.getConfig(ctx(req))))

router.get('/preference', bartender, jsonHandler(async req => ({ preference: await pushService.getPreference(ctx(req)) })))

router.put('/preference', bartender, jsonHandler(req => {
    if (typeof req.body?.enabled !== 'boolean') throw new BadRequestError('Valore non valido')
    return pushService.setPreference(ctx(req), req.body.enabled)
}))

router.post('/subscriptions', bartender, jsonHandler(req =>
    pushService.subscribe(ctx(req), toSubscription(req.body), req.get('user-agent'))))

router.delete('/subscriptions', bartender, jsonHandler(req => {
    if (typeof req.body?.endpoint !== 'string') throw new BadRequestError('Endpoint mancante')
    return pushService.unsubscribe(ctx(req), req.body.endpoint)
}))

export default router
