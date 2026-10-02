import { Router } from 'express'
import masterTableService from '../services/master-table'
import { jsonHandler, requireRole, Roles, STAFF_ROLES } from '../http/middleware'
import { toId } from '../http/validate'

const router = Router()
const admin = requireRole(Roles.admin)

router.get('/layout', admin, jsonHandler(() => masterTableService.getLayout()))
router.put('/layout', admin, jsonHandler(req => masterTableService.saveLayout(req.body)))
router.get('/', admin, jsonHandler(() => masterTableService.getAll()))
/** Returns `0` when the table doesn't exist (the client relies on it). */
router.get('/:id', requireRole(...STAFF_ROLES),
    jsonHandler(async req => (await masterTableService.getEventTable(toId(req.params.id))) || 0))
router.post('/', admin, jsonHandler(req => masterTableService.create(req.body)))
router.put('/', admin, jsonHandler(req => masterTableService.update(req.body)))

export default router
