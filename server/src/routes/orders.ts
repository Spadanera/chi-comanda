import { Router } from 'express'
import orderService from '../services/order'
import { currentUserId, jsonHandler, requireRole, Roles } from '../http/middleware'
import { toId, toIdList, toIdListFromJson } from '../http/validate'

const router = Router()
const floorStaff = requireRole(Roles.waiter, Roles.bartender, Roles.checkout)

/** `destinationsids` is a JSON array, e.g. `/orders/3/[1,2]`. */
router.get('/:eventid/:destinationsids', floorStaff, jsonHandler(req =>
    orderService.getAll(toId(req.params.eventid), toIdListFromJson(req.params.destinationsids, 'destinationsids'))))

router.post('/', floorStaff, jsonHandler(req => orderService.create(req.body, currentUserId(req))))

router.put('/:order_id/complete', requireRole(Roles.bartender), jsonHandler(req =>
    orderService.complete(toId(req.params.order_id), { ...req.body, item_ids: toIdList(req.body.item_ids || [], 'item_ids') })))

export default router
