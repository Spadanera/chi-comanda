import router, { Router, Request, Response } from "express"
import userApi from "../api/user"
import { asyncHandler } from "../utils/asyncHandler"

const userRouter: Router = router()

userRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
    const result = await userApi.getAll()
    res.status(200).json(result)
}))

userRouter.put("/", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.update(req.body)
    res.status(200).json(result)
}))

userRouter.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.delete(+req.params.id)
    res.status(200).json(result)
}))

userRouter.put("/roles", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.updateRoles(req.body)
    res.status(200).json(result)
}))

userRouter.post("/invite", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.inviteUser(req.body)
    res.status(200).json(result)
}))

export default userRouter
