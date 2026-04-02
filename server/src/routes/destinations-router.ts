import router, { Router, Request, Response } from "express"
import destinationApi from "../api/destination"
import { authorizationMiddleware, Roles } from "../utils/helper"
import { asyncHandler } from "../utils/asyncHandler"

const destinationsRouter: Router = router()

destinationsRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
    const result = await destinationApi.getAll()
    res.status(200).json(result)
}))

destinationsRouter.post("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await destinationApi.create(req.body)
    res.status(200).json(result)
}))

destinationsRouter.put("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await destinationApi.update(req.body)
    res.status(200).json(result)
}))

export default destinationsRouter
