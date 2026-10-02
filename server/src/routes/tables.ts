import { Router } from 'express'
import tableService from '../services/table'
import { currentUserId, jsonHandler, requireRole, Roles, STAFF_ROLES } from '../http/middleware'
import { toId, toIdList } from '../http/validate'

const router = Router()
const checkout = requireRole(Roles.checkout)

router.put('/:id/change/:masterid', checkout,
    jsonHandler(req => tableService.changePosition(toId(req.params.id), toId(req.params.masterid))))

router.get('/', requireRole(...STAFF_ROLES), jsonHandler(() => tableService.getAll()))

router.get('/:id', requireRole(...STAFF_ROLES), jsonHandler(req => tableService.get(toId(req.params.id))))

router.post('/', requireRole(...STAFF_ROLES), jsonHandler(req => tableService.create(req.body, currentUserId(req))))

router.put('/:id', requireRole(Roles.waiter, Roles.bartender, Roles.checkout),
    jsonHandler(req => tableService.updateStatus(toId(req.params.id), req.body.status)))

router.put('/:id/payitems', checkout,
    jsonHandler(req => tableService.paySelectedItems(toId(req.params.id), toIdList(req.body, 'item_ids'))))

router.put('/:id/complete', checkout, jsonHandler(req => tableService.close(toId(req.params.id))))

export default router
