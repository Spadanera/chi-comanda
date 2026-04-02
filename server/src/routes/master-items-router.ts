import router, { Router, Request, Response } from "express"
import masterItemsApi from "../api/master-item"
import { authorizationMiddleware, Roles } from "../utils/helper"
import { asyncHandler } from "../utils/asyncHandler"

const masterItemsRouter: Router = router()

masterItemsRouter.get("/:id", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.getAll(+req.params.id)
    res.status(200).json(result)
}))

masterItemsRouter.get("/available/:id", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.getAllAvailable(+req.params.id)
    res.status(200).json(result)
}))

masterItemsRouter.post("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.create(req.body)
    res.status(200).json(result)
}))

masterItemsRouter.put("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.update(req.body)
    res.status(200).json(result)
}))

masterItemsRouter.delete("/:id", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.delete(+req.params.id)
    res.status(200).json(result)
}))

export default masterItemsRouter
