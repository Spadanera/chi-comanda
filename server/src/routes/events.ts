import { Router } from 'express'
import eventService, { EventStatus } from '../services/event'
import tableService from '../services/table'
import userService from '../services/user'
import { currentUserId, jsonHandler, requireRole, Roles, STAFF_ROLES } from '../http/middleware'
import { BadRequestError } from '../http/errors'
import { toId } from '../http/validate'

const EVENT_STATUSES: EventStatus[] = ['PLANNED', 'ONGOING', 'CLOSED']

function toStatus(value: unknown): EventStatus {
    if (!EVENT_STATUSES.includes(value as EventStatus)) {
        throw new BadRequestError('Stato evento non valido')
    }
    return value as EventStatus
}

const router = Router()
const floorStaff = requireRole(Roles.waiter, Roles.bartender, Roles.checkout)

router.get('/ongoing', jsonHandler(req => eventService.getOnGoing(currentUserId(req))))

router.get('/users', requireRole(...STAFF_ROLES), jsonHandler(() => userService.getAvailable()))

// ── Admin ────────────────────────────────────────────────────────────────────

router.get('/status/:status', requireRole(Roles.admin),
    jsonHandler(req => eventService.getAll(toStatus(req.params.status), req.query as Record<string, string>)))

router.get('/:id/status/:status', requireRole(Roles.admin),
    jsonHandler(req => eventService.getReport(toId(req.params.id), toStatus(req.params.status))))

router.post('/', requireRole(Roles.admin), jsonHandler(req => eventService.create(req.body)))

router.put('/setstatus/:id', requireRole(Roles.admin),
    jsonHandler(req => eventService.updateStatus(toId(req.params.id), toStatus(req.body.status))))

router.put('/', requireRole(Roles.admin), jsonHandler(req => eventService.update(req.body)))

router.delete('/:id', requireRole(Roles.admin), jsonHandler(req => eventService.delete(toId(req.params.id))))

// ── Tables of an event ───────────────────────────────────────────────────────

router.get('/:id/tables/available', floorStaff, jsonHandler(req => tableService.getAvailable(toId(req.params.id))))

router.get('/:id/tables/layout', floorStaff, jsonHandler(req => tableService.getLayout(toId(req.params.id))))

router.put('/:id/tables/layout', floorStaff, jsonHandler(req => tableService.saveLayout(req.body, toId(req.params.id))))

router.get('/:id/tables/free', requireRole(Roles.checkout), jsonHandler(req => tableService.getFree(toId(req.params.id))))

router.post('/:id/tables/multiple', requireRole(...STAFF_ROLES), jsonHandler(req => {
    if (!Array.isArray(req.body) || !req.body.every(n => typeof n === 'string')) {
        throw new BadRequestError('Elenco nomi tavoli non valido')
    }
    return tableService.insertMultiple(toId(req.params.id), req.body, currentUserId(req))
}))

router.get('/:id/tables', requireRole(...STAFF_ROLES), jsonHandler(req => tableService.getByEvent(toId(req.params.id))))

router.get('/:eventid/tables/:tableid/items', requireRole(Roles.checkout),
    jsonHandler(req => tableService.getWithItems(toId(req.params.tableid), toId(req.params.eventid))))

router.post('/:eventid/tables/:tableid/discount/:discount', requireRole(Roles.checkout), jsonHandler(req => {
    const discount = Number(req.params.discount)
    if (!Number.isFinite(discount) || discount <= 0) {
        throw new BadRequestError('Sconto non valido')
    }
    return tableService.insertDiscount(toId(req.params.eventid), toId(req.params.tableid), discount)
}))

export default router
