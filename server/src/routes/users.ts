import { Router } from 'express'
import userService from '../services/user'
import { jsonHandler } from '../http/middleware'
import { toId } from '../http/validate'

/** User management, superuser only (enforced where mounted). */
const router = Router()

router.get('/', jsonHandler(() => userService.getAll()))
router.put('/', jsonHandler(req => userService.updateStatus(req.body)))
router.delete('/:id', jsonHandler(req => userService.delete(toId(req.params.id))))
router.put('/roles', jsonHandler(req => userService.updateRoles(req.body)))
router.post('/invite', jsonHandler(req => userService.inviteUser(req.body)))

export default router

export const userAvatarRouter = Router()
userAvatarRouter.get('/avatar/:id', jsonHandler(async (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400')
    return userService.getAvatar(toId(req.params.id))
}))
