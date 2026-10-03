import { Router } from 'express'
import userService from '../services/user'
import venueService from '../services/venue'
import staffService from '../services/staff'
import { currentUserId, jsonHandler, Roles } from '../http/middleware'
import { toId } from '../http/validate'
import { venueContext } from '../venue/context'
import { BadRequestError } from '../http/errors'

/** The platform: venues and every user of the installation (superuser only, enforced where mounted; no venue). */
const router = Router()

router.get('/venues', jsonHandler(() => venueService.getAll()))

/** Creates a venue; with `admin_email` its first admin is invited too. */
router.post('/venues', jsonHandler(async req => {
    const venueId = await venueService.create(req.body || {})
    if (req.body?.admin_email) {
        await staffService.invite(venueContext(venueId, currentUserId(req), [Roles.superuser]),
            { email: req.body.admin_email, roles: [Roles.admin] })
    }
    return venueId
}))

router.put('/venues/:id', jsonHandler(req => venueService.update(toId(req.params.id), req.body || {})))

router.get('/users', jsonHandler(() => userService.getAll()))

router.put('/users/:id/status', jsonHandler(req => userService.updateStatus({ id: toId(req.params.id), status: req.body?.status })))

router.put('/users/:id/superuser', jsonHandler(req => {
    if (typeof req.body?.superuser !== 'boolean') throw new BadRequestError('Valore non valido')
    return userService.setSuperuser(toId(req.params.id), req.body.superuser)
}))

router.delete('/users/:id', jsonHandler(req => userService.delete(toId(req.params.id))))

export default router
