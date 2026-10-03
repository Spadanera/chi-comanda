import { Router } from 'express'
import masterTableService from '../services/master-table'
import { ctx } from '../venue/context'
import { jsonHandler, requireRole, Roles, STAFF_ROLES } from '../http/middleware'
import { toId } from '../http/validate'

const router = Router()
const admin = requireRole(Roles.admin)

router.get('/layout', admin, jsonHandler(req => masterTableService.getLayout(ctx(req))))
router.put('/layout', admin, jsonHandler(req => masterTableService.saveLayout(ctx(req), req.body)))
/** Returns `0` when the table doesn't exist (the client relies on it). */
router.get('/:id', requireRole(...STAFF_ROLES),
    jsonHandler(async req => (await masterTableService.getEventTable(ctx(req), toId(req.params.id))) || 0))

export default router
