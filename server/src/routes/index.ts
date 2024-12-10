import router, { Router } from "express"
import publicApiRouter from "./public"
import { Roles, authorizationMiddleware } from "../utils/helper"
import userRouter from "./users-router" 
import eventsRouter from "./events-router"
import tablesRouter from "./tables-router"
import ordersRouter from "./orders-router"
import itemsRouter from "./items-router"
import destinationsRouter from "./destinations-router"
import masterItemsRouter from "./master-items-router"
import masterTableRouter from "./master-tables-router"
import menuRouter from "./menu-router"
import typesRouter from "./types-router"
import subTypesRouter from "./sub-types-router"
import auditRouter from "./audit-router"
import profileRouter from "./profile-router"
import broadcastRouter from "./broadcast-router"
import userPublicRouter from "./users-public-routes"

const apiRouter: Router = router()

apiRouter.use("/users", authorizationMiddleware(Roles.superuser), userRouter)
apiRouter.use("/events", eventsRouter)
apiRouter.use("/tables", tablesRouter)
apiRouter.use("/orders", ordersRouter)
apiRouter.use("/items", authorizationMiddleware([Roles.bartender, Roles.checkout]), itemsRouter)
apiRouter.use("/menu", authorizationMiddleware(Roles.admin), menuRouter)
apiRouter.use("/destinations", destinationsRouter)
apiRouter.use("/master-items", masterItemsRouter)
apiRouter.use("/types", authorizationMiddleware(Roles.admin), typesRouter)
apiRouter.use("/subtypes", subTypesRouter)
apiRouter.use("/master-tables", masterTableRouter)
apiRouter.use("/audit", authorizationMiddleware(Roles.superuser), auditRouter)
apiRouter.use("/profile", profileRouter) 
apiRouter.use("/broadcast", broadcastRouter) 
apiRouter.use("/users-public", userPublicRouter)
apiRouter.use("/public", publicApiRouter)

export default apiRouter

