import { Router } from 'express'
import itemService from '../services/item'
import { jsonHandler } from '../http/middleware'
import { toId } from '../http/validate'

const router = Router()

router.delete('/:id', jsonHandler(req => itemService.delete(toId(req.params.id))))

router.put('/', jsonHandler(req => itemService.update(req.body)))

/** Same as PUT / but also re-opens the item's table (used when un-paying an item of a closed table). */
router.put('/open', jsonHandler(req => itemService.update(req.body, true)))

export default router
