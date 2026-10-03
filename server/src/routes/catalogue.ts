import { Router } from 'express'
import catalogueService from '../services/catalogue'
import { jsonHandler, requireRole, Roles, STAFF_ROLES } from '../http/middleware'
import { toId } from '../http/validate'
import { ctx } from '../venue/context'

const admin = requireRole(Roles.admin)

export const menuRouter = Router()
menuRouter.use(admin)
menuRouter.get('/', jsonHandler(req => catalogueService.getAllMenu(ctx(req))))
menuRouter.post('/', jsonHandler(req => catalogueService.createMenu(ctx(req), req.body)))
menuRouter.put('/', jsonHandler(req => catalogueService.editMenu(ctx(req), req.body)))
menuRouter.delete('/:id', jsonHandler(req => catalogueService.deleteMenu(ctx(req), toId(req.params.id))))

export const masterItemsRouter = Router()
masterItemsRouter.get('/available/:id', requireRole(Roles.waiter, Roles.bartender, Roles.checkout),
    jsonHandler(req => catalogueService.getAllAvailable(ctx(req), toId(req.params.id))))
masterItemsRouter.get('/:id', admin, jsonHandler(req => catalogueService.getAll(ctx(req), toId(req.params.id))))
masterItemsRouter.post('/', admin, jsonHandler(req => catalogueService.create(ctx(req), req.body)))
masterItemsRouter.put('/', admin, jsonHandler(req => catalogueService.update(ctx(req), req.body)))

export const typesRouter = Router()
typesRouter.use(admin)
typesRouter.get('/', jsonHandler(req => catalogueService.getTypes(ctx(req))))
typesRouter.post('/', jsonHandler(req => catalogueService.createType(ctx(req), req.body)))
typesRouter.put('/', jsonHandler(req => catalogueService.updateType(ctx(req), req.body)))
typesRouter.delete('/:id', jsonHandler(req => catalogueService.deleteType(ctx(req), toId(req.params.id))))

export const subTypesRouter = Router()
subTypesRouter.get('/', requireRole(...STAFF_ROLES), jsonHandler(req => catalogueService.getSubTypes(ctx(req))))
subTypesRouter.post('/', admin, jsonHandler(req => catalogueService.createSubType(ctx(req), req.body)))
subTypesRouter.put('/', admin, jsonHandler(req => catalogueService.updateSubType(ctx(req), req.body)))
subTypesRouter.delete('/:id', admin, jsonHandler(req => catalogueService.deleteSubType(ctx(req), toId(req.params.id))))
