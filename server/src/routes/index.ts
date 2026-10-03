import { Router } from 'express'
import { auditMiddleware, requireAuthentication, requireFeature, requireRole, Roles } from '../http/middleware'
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
import settingsRouter from './settings'
import { requireVenue } from '../venue/context'

/** Everything under /api. */
const apiRouter = Router()

apiRouter.use(authRouter)
apiRouter.use('/public', publicRouter)

apiRouter.use(requireAuthentication)

// ── Platform: no venue (audited with venue NULL) ────────────────────────────
apiRouter.use('/users', auditMiddleware, requireRole(Roles.superuser), usersRouter)
apiRouter.use('/users-public', userAvatarRouter)
apiRouter.use('/audit', requireRole(Roles.superuser), auditRouter)
apiRouter.use('/profile', auditMiddleware, profileRouter)

// ── Everything else works on the venue chosen in the session ────────────────
apiRouter.use(requireVenue, auditMiddleware)
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
apiRouter.use('/broadcast', requireFeature('broadcast'), broadcastRouter)
apiRouter.use('/payment', requireFeature('payments'), paymentsRouter)
apiRouter.use('/push', requireFeature('push'), pushRouter)
apiRouter.use('/settings', requireRole(Roles.admin), settingsRouter)

export { publicRouter }
export default apiRouter
