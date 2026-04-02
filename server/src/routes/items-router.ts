import router, { Router, Request, Response } from "express"
import itemApi from "../api/item"
import { asyncHandler } from "../utils/asyncHandler"

const itemsRouter: Router = router()

itemsRouter.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
    const result = await itemApi.delete(+req.params.id)
    res.status(200).json(result)
}))

itemsRouter.put("/", asyncHandler(async (req: Request, res: Response) => {
    const result = await itemApi.update(req.body)
    res.status(200).json(result)
}))

itemsRouter.put("/open", asyncHandler(async (req: Request, res: Response) => {
    const result = await itemApi.update(req.body, true)
    res.status(200).json(result)
}))

export default itemsRouter
