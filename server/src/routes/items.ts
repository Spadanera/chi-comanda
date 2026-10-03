import { Router } from 'express'
import itemService from '../services/item'
import { jsonHandler } from '../http/middleware'
import { ctx } from '../venue/context'
import { toId } from '../http/validate'

const router = Router()

router.delete('/:id', jsonHandler(req => itemService.delete(ctx(req), toId(req.params.id))))

router.put('/', jsonHandler(req => itemService.update(ctx(req), req.body)))

/** Same as PUT / but also re-opens the item's table (used when un-paying an item of a closed table). */
router.put('/open', jsonHandler(req => itemService.update(ctx(req), req.body, true)))

export default router
