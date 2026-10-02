import { Router } from 'express'
import catalogueService from '../services/catalogue'
import { jsonHandler, requireRole, Roles, STAFF_ROLES } from '../http/middleware'
import { toId } from '../http/validate'

const admin = requireRole(Roles.admin)

export const menuRouter = Router()
menuRouter.use(admin)
menuRouter.get('/', jsonHandler(() => catalogueService.getAllMenu()))
menuRouter.post('/', jsonHandler(req => catalogueService.createMenu(req.body)))
menuRouter.put('/', jsonHandler(req => catalogueService.editMenu(req.body)))
menuRouter.delete('/:id', jsonHandler(req => catalogueService.deleteMenu(toId(req.params.id))))

export const masterItemsRouter = Router()
masterItemsRouter.get('/available/:id', requireRole(Roles.waiter, Roles.bartender, Roles.checkout),
    jsonHandler(req => catalogueService.getAllAvailable(toId(req.params.id))))
masterItemsRouter.get('/:id', admin, jsonHandler(req => catalogueService.getAll(toId(req.params.id))))
masterItemsRouter.post('/', admin, jsonHandler(req => catalogueService.create(req.body)))
masterItemsRouter.put('/', admin, jsonHandler(req => catalogueService.update(req.body)))

export const typesRouter = Router()
typesRouter.use(admin)
typesRouter.get('/', jsonHandler(() => catalogueService.getTypes()))
typesRouter.post('/', jsonHandler(req => catalogueService.createType(req.body)))
typesRouter.put('/', jsonHandler(req => catalogueService.updateType(req.body)))
typesRouter.delete('/:id', jsonHandler(req => catalogueService.deleteType(toId(req.params.id))))

export const subTypesRouter = Router()
subTypesRouter.get('/', requireRole(...STAFF_ROLES), jsonHandler(() => catalogueService.getSubTypes()))
subTypesRouter.post('/', admin, jsonHandler(req => catalogueService.createSubType(req.body)))
subTypesRouter.put('/', admin, jsonHandler(req => catalogueService.updateSubType(req.body)))
subTypesRouter.delete('/:id', admin, jsonHandler(req => catalogueService.deleteSubType(toId(req.params.id))))
