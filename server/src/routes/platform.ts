import { Router } from 'express'
import userService from '../services/user'
import venueService from '../services/venue'
import staffService from '../services/staff'
import { currentUserId, jsonHandler, Roles } from '../http/middleware'
import { toId } from '../http/validate'
import { venueContext } from '../venue/context'
import { disconnectUser, disconnectVenue } from '../socket'
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

router.put('/venues/:id', jsonHandler(async req => {
    const id = toId(req.params.id)
    await venueService.update(id, req.body || {})
    // A disabled venue (or one with fewer features) must not keep its screens connected
    disconnectVenue(id)
}))

router.get('/users', jsonHandler(() => userService.getAll()))

/** Runs a change on an account, then drops its sockets: they rejoin with what the account holds now. */
const changeUser = (change: (id: number, body: any) => Promise<unknown>) => jsonHandler(async req => {
    const id = toId(req.params.id)
    await change(id, req.body || {})
    disconnectUser(id)
})

router.put('/users/:id/status', changeUser((id, body) => userService.updateStatus({ id, status: body.status })))

router.put('/users/:id/superuser', changeUser((id, body) => {
    if (typeof body.superuser !== 'boolean') throw new BadRequestError('Valore non valido')
    return userService.setSuperuser(id, body.superuser)
}))

router.delete('/users/:id', changeUser(id => userService.delete(id)))

export default router
