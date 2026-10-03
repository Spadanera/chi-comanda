import { Router } from 'express'
import destinationService from '../services/destination'
import { ctx } from '../venue/context'
import { jsonHandler, requireRole, Roles } from '../http/middleware'

const router = Router()

router.get('/', jsonHandler(req => destinationService.getAll(ctx(req))))
router.post('/', requireRole(Roles.admin), jsonHandler(req => destinationService.create(ctx(req), req.body)))
router.put('/', requireRole(Roles.admin), jsonHandler(req => destinationService.update(ctx(req), req.body)))

export default router
