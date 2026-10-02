import { Router } from 'express'
import destinationService from '../services/destination'
import { jsonHandler, requireRole, Roles } from '../http/middleware'

const router = Router()

router.get('/', jsonHandler(() => destinationService.getAll()))
router.post('/', requireRole(Roles.admin), jsonHandler(req => destinationService.create(req.body)))
router.put('/', requireRole(Roles.admin), jsonHandler(req => destinationService.update(req.body)))

export default router
