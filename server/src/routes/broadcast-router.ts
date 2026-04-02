import router, { Router, Request, Response } from "express"
import broadcastApi from "../api/broadcast"
import { User } from "../../../models/src"
import { asyncHandler } from "../utils/asyncHandler"

export const authorizationMiddleware = () => (req: Request, res: Response, next: any) => {
    const userId = (req.user as User).id
    if (userId && +req.body.sender?.id === +userId) {
        next()
    } else {
        res.status(401).json('Unauthorized')
    }
}

const broadcastRouter: Router = router()

broadcastRouter.post("/", authorizationMiddleware(), asyncHandler(async (req: Request, res: Response) => {
    const result = await broadcastApi.broadcastMessage(req.body)
    res.status(200).json(result)
}))

export default broadcastRouter
