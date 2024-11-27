import router, { Router, Request, Response } from "express"
import orderApi from "../api/order"
import { authorizationMiddleware, Roles } from "../utils/helper"
import { CompleteOrderInput } from "../../../models/src"
import itemApi from "../api/item"

const ordersRouter: Router = router()

ordersRouter.get("/:eventid/:destinationsids", authorizationMiddleware(Roles.bartender), async (req: Request, res: Response) => {
    try {
        const result = await orderApi.getAll(+req.params.eventid, JSON.parse(req.params.destinationsids))
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

ordersRouter.post("/", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any).id
        const result = await orderApi.create(req.body, +userId)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

// order items API
ordersRouter.get("/:id/items", authorizationMiddleware([Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await itemApi.getByOrderId(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

ordersRouter.put("/:order_id/complete", authorizationMiddleware(Roles.bartender), async (req: Request, res: Response) => {
    try {
        const result = await orderApi.completeOrder(+req.params.order_id, req.body as CompleteOrderInput)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})


export default ordersRouter