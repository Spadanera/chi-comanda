import { Router } from 'express'
import { auditMiddleware, requireAuthentication, requireRole, Roles } from '../http/middleware'
import authRouter from './auth-router'
import publicRouter from './public'
import usersRouter, { userAvatarRouter } from './users'
import eventsRouter from './events'
import tablesRouter from './tables'
import ordersRouter from './orders'
import itemsRouter from './items'
import destinationsRouter from './destinations'
import { masterItemsRouter, menuRouter, subTypesRouter, typesRouter } from './catalogue'
import masterTablesRouter from './master-tables'
import auditRouter from './audit'
import profileRouter from './profile'
import broadcastRouter from './broadcast'
import paymentsRouter from './payments'
import pushRouter from './push'

/** Everything under /api. */
const apiRouter = Router()

apiRouter.use(authRouter)
apiRouter.use('/public', publicRouter)

apiRouter.use(requireAuthentication, auditMiddleware)
apiRouter.use('/users', requireRole(Roles.superuser), usersRouter)
apiRouter.use('/users-public', userAvatarRouter)
apiRouter.use('/events', eventsRouter)
apiRouter.use('/tables', tablesRouter)
apiRouter.use('/orders', ordersRouter)
apiRouter.use('/items', requireRole(Roles.bartender, Roles.checkout), itemsRouter)
apiRouter.use('/menu', menuRouter)
apiRouter.use('/destinations', destinationsRouter)
apiRouter.use('/master-items', masterItemsRouter)
apiRouter.use('/types', typesRouter)
apiRouter.use('/subtypes', subTypesRouter)
apiRouter.use('/master-tables', masterTablesRouter)
apiRouter.use('/audit', requireRole(Roles.superuser), auditRouter)
apiRouter.use('/profile', profileRouter)
apiRouter.use('/broadcast', broadcastRouter)
apiRouter.use('/payment', paymentsRouter)
apiRouter.use('/push', pushRouter)

export { publicRouter }
export default apiRouter
