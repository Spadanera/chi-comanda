import { Router } from 'express'
import orderService from '../services/order'
import { jsonHandler, requireRole, Roles } from '../http/middleware'
import { ctx } from '../venue/context'
import { toId, toIdList, toIdListFromJson } from '../http/validate'

const router = Router()
const floorStaff = requireRole(Roles.waiter, Roles.bartender, Roles.checkout)

/** `destinationsids` is a JSON array, e.g. `/orders/3/[1,2]`. */
router.get('/:eventid/:destinationsids', floorStaff, jsonHandler(req =>
    orderService.getAll(ctx(req), toId(req.params.eventid), toIdListFromJson(req.params.destinationsids, 'destinationsids'))))

router.post('/', floorStaff, jsonHandler(req => orderService.create(ctx(req), req.body)))

router.put('/:order_id/complete', requireRole(Roles.bartender), jsonHandler(req =>
    orderService.complete(ctx(req), toId(req.params.order_id), { ...req.body, item_ids: toIdList(req.body.item_ids || [], 'item_ids') })))

export default router
