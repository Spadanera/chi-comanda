import router, { Router, Request, Response } from "express"
import orderApi from "../api/order"
import { authorizationMiddleware, Roles } from "../utils/helper"
import { CompleteOrderInput } from "../../../models/src"
import itemApi from "../api/item"
import { asyncHandler } from "../utils/asyncHandler"

const ordersRouter: Router = router()

ordersRouter.get("/:eventid/:destinationsids", authorizationMiddleware([Roles.bartender, Roles.checkout, Roles.waiter]), asyncHandler(async (req: Request, res: Response) => {
    const eventId = +req.params.eventid
    const destinationsIds = JSON.parse(req.params.destinationsids as string)
    const result = await orderApi.getAll(eventId, destinationsIds)
    res.status(200).json(result)
}))

ordersRouter.post("/", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id
    const result = await orderApi.create(req.body, +userId)
    res.status(200).json(result)
}))

ordersRouter.get("/:id/items", authorizationMiddleware([Roles.bartender, Roles.checkout, Roles.waiter]), asyncHandler(async (req: Request, res: Response) => {
    const result = await itemApi.getByOrderId(+req.params.id)
    res.status(200).json(result)
}))

ordersRouter.put("/:order_id/complete", authorizationMiddleware(Roles.bartender), asyncHandler(async (req: Request, res: Response) => {
    const result = await orderApi.completeOrder(+req.params.order_id, req.body as CompleteOrderInput)
    res.status(200).json(result)
}))

export default ordersRouter
