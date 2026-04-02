import router, { Router, Request, Response } from "express"
import masterTableApi from "../api/master-table"
import { authorizationMiddleware, Roles } from "../utils/helper"
import { asyncHandler } from "../utils/asyncHandler"

const masterTableRouter: Router = router()

masterTableRouter.get("/layout", authorizationMiddleware(Roles.admin), asyncHandler(async (_req: Request, res: Response) => {
    const result = await masterTableApi.getLayout()
    res.status(200).json(result)
}))

masterTableRouter.put("/layout", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterTableApi.saveLayout(req.body)
    res.status(200).json(result)
}))

masterTableRouter.get("/", authorizationMiddleware(Roles.admin), asyncHandler(async (_req: Request, res: Response) => {
    const result = await masterTableApi.getAll()
    res.status(200).json(result)
}))

masterTableRouter.get("/:id", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout, Roles.admin]), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterTableApi.get(+req.params.id)
    if (result && result.length) {
        res.status(200).json(result[0])
    } else {
        res.status(200).json(0)
    }
}))

masterTableRouter.post("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterTableApi.create(req.body)
    res.status(200).json(result)
}))

masterTableRouter.put("/", authorizationMiddleware(Roles.admin), asyncHandler(async (req: Request, res: Response) => {
    const result = await masterTableApi.update(req.body)
    res.status(200).json(result)
}))

export default masterTableRouter
