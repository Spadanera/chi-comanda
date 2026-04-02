import router, { Router, Request, Response } from "express"
import userApi from "../api/user"
import { asyncHandler } from "../utils/asyncHandler"

const userPublicRouter: Router = router()

userPublicRouter.get("/avatar/:id", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.getAvatar(+req.params.id)
    res.set('Cache-Control', 'public, max-age=86400')
    res.status(200).json(result)
}))

export default userPublicRouter
