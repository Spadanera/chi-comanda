import { Router } from 'express'
import tableService from '../services/table'
import { jsonHandler, requireRole, Roles, STAFF_ROLES } from '../http/middleware'
import { ctx } from '../venue/context'
import { idempotentHandler } from '../http/idempotency'
import { toId, toIdList } from '../http/validate'

const router = Router()
const checkout = requireRole(Roles.checkout)

router.put('/:id/change/:masterid', checkout,
    jsonHandler(req => tableService.changePosition(ctx(req), toId(req.params.id), toId(req.params.masterid))))

router.get('/:id', requireRole(...STAFF_ROLES), jsonHandler(req => tableService.get(ctx(req), toId(req.params.id))))

router.put('/:id/payitems', checkout,
    idempotentHandler((req, c) => tableService.paySelectedItems(c.db, toId(req.params.id), toIdList(req.body, 'item_ids'))))

router.put('/:id/complete', checkout, idempotentHandler((req, c) => tableService.close(c, toId(req.params.id))))

export default router
