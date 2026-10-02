import { Router } from 'express'
import auditService from '../services/audit'
import { jsonHandler } from '../http/middleware'
import { toNonNegativeInt } from '../http/validate'

const router = Router()

router.get('/', jsonHandler(req => auditService.get(
    toNonNegativeInt(req.query.page, 1),
    toNonNegativeInt(req.query.itemsperpage, 25),
    req.query.sortby?.toString(),
    req.query.sortdir?.toString(),
)))

export default router
