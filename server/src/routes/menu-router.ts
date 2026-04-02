import router, { Router, Request, Response } from "express"
import masterItemsApi from "../api/master-item"
import { asyncHandler } from "../utils/asyncHandler"

const menuRouter: Router = router()

menuRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
    const result = await masterItemsApi.getAllMenu()
    res.status(200).json(result)
}))

menuRouter.post("/", asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.createMenu(req.body)
    res.status(200).json(result)
}))

menuRouter.put("/", asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.editMenu(req.body)
    res.status(200).json(result)
}))

menuRouter.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
    const result = await masterItemsApi.deleteMenu(+req.params.id)
    res.status(200).json(result)
}))

export default menuRouter
