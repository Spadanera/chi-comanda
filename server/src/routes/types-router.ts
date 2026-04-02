import router, { Router, Request, Response } from "express"
import masterItemsApi from "../api/master-item"
import { asyncHandler } from "../utils/asyncHandler"

const typesRouter: Router = router()

typesRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
    const result = await masterItemsApi.getTypes()
    res.status(200).json(result)
}))

typesRouter.post("/", asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.createType(req.body)
    res.status(200).json(result)
}))

typesRouter.put("/", asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.updateType(req.body)
    res.status(200).json(result)
}))

typesRouter.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.deleteType(+req.params.id)
    res.status(200).json(result)
}))

export default typesRouter
