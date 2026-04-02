import router, { Router, Request, Response } from "express"
import masterItemsApi from "../api/master-item"
import { authorizationMiddleware, Roles } from "../utils/helper"
import { asyncHandler } from "../utils/asyncHandler"

const subTypesRouter: Router = router()

subTypesRouter.get("/", authorizationMiddleware([Roles.admin, Roles.bartender, Roles.checkout, Roles.waiter]), asyncHandler(async (_req: Request, res: Response) => {
    const result = await masterItemsApi.getSubTypes()
    res.status(200).json(result)
}))

subTypesRouter.post("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.createSubTypes(req.body)
    res.status(200).json(result)
}))

subTypesRouter.put("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.updateSubTypes(req.body)
    res.status(200).json(result)
}))

subTypesRouter.delete("/:id", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.deleteSubtypes(+req.params.id)
    res.status(200).json(result)
}))

export default subTypesRouter
