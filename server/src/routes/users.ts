import { Router } from 'express'
import userService from '../services/user'
import staffService from '../services/staff'
import { jsonHandler } from '../http/middleware'
import { toId } from '../http/validate'
import { ctx } from '../venue/context'

/** Staff of the active venue (role check where mounted). */
const router = Router()

router.get('/', jsonHandler(req => staffService.getAll(ctx(req))))
router.put('/', jsonHandler(req => staffService.updateStatus(ctx(req), req.body)))
router.delete('/:id', jsonHandler(req => staffService.remove(ctx(req), toId(req.params.id))))
router.put('/roles', jsonHandler(req => staffService.updateRoles(ctx(req), req.body)))
router.post('/invite', jsonHandler(req => staffService.invite(ctx(req), req.body)))

export default router

export const userAvatarRouter = Router()
userAvatarRouter.get('/avatar/:id', jsonHandler(async (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400')
    return userService.getAvatar(toId(req.params.id))
}))
