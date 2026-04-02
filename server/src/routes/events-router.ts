import router, { Router, Request, Response } from "express"
import eventApi from "../api/event"
import tableApi from "../api/table"
import { authorizationMiddleware, Roles } from "../utils/helper"
import userApi from "../api/user"
import { asyncHandler } from "../utils/asyncHandler"

const eventsRouter: Router = router()

eventsRouter.get("/ongoing", asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id
    const result = await eventApi.getOnGoing(+userId)
    res.status(200).json(result)
}))

eventsRouter.get("/users", asyncHandler(async (_req: Request, res: Response) => {
    const result = await userApi.getAvailable()
    res.status(200).json(result)
}))

eventsRouter.get("/status/:status", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as Record<string, any>
    const status = req.params.status as string
    const result = await eventApi.getAll(status, query)
    res.status(200).json(result)
}))

eventsRouter.get("/:id/status/:status", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const status = req.params.status as string
    const result = await eventApi.get(+req.params.id, status)
    if (result.length) {
        res.status(200).json(result[0])
    } else {
        res.status(400).json('Resource not found')
    }
}))

eventsRouter.post("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await eventApi.create(req.body)
    res.status(200).json(result)
}))

eventsRouter.put("/setstatus/:id", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await eventApi.updateStatus(req.body)
    res.status(200).json(result)
}))

eventsRouter.put("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await eventApi.update(req.body)
    res.status(200).json(result)
}))

eventsRouter.delete("/:id", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await eventApi.delete(+req.params.id)
    res.status(200).json(result)
}))

eventsRouter.get("/:id/tables/available", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), asyncHandler(async (req: Request, res: Response) => {
    const result = await tableApi.getAvailableTable(+req.params.id)
    res.status(200).json(result)
}))

eventsRouter.get("/:id/tables/layout", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), asyncHandler(async (req: Request, res: Response) => {
    const result = await tableApi.getLayout(+req.params.id)
    res.status(200).json(result)
}))

eventsRouter.put("/:id/tables/layout", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), asyncHandler(async (req: Request, res: Response) => {
    const result = await tableApi.saveLayout(req.body, +req.params.id)
    res.status(200).json(result)
}))

eventsRouter.get("/:id/tables/free", authorizationMiddleware(Roles.checkout), asyncHandler(async (req: Request, res: Response) => {
    const result = await tableApi.getFreeTable(+req.params.id)
    res.status(200).json(result)
}))

eventsRouter.post("/:id/tables/multiple", authorizationMiddleware([Roles.checkout, Roles.bartender, Roles.admin, Roles.waiter]), asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id
    const result = await tableApi.insertMultipleTables(+req.params.id, req.body, +userId)
    res.status(200).json(result)
}))

eventsRouter.get("/:id/tables", asyncHandler(async (req: Request, res: Response) => {
    const result = await tableApi.getActiveTable(+req.params.id)
    res.status(200).json(result)
}))

eventsRouter.get("/:eventid/tables/:tableid/items", authorizationMiddleware(Roles.checkout), asyncHandler(async (req: Request, res: Response) => {
    const result = await tableApi.getTableItems(+req.params.tableid, +req.params.eventid)
    res.status(200).json(result)
}))

eventsRouter.post("/:eventid/tables/:tableid/discount/:discount", authorizationMiddleware(Roles.checkout), asyncHandler(async (req: Request, res: Response) => {
    const result = await tableApi.insertDiscount(+req.params.eventid, +req.params.tableid, +req.params.discount)
    res.status(200).json(result)
}))

export default eventsRouter
