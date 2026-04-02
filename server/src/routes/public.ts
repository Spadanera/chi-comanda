import router, { Router, Request, Response } from "express"
import userApi from "../api/user"
import multer from 'multer'
import { fileToBase64String } from '../utils/helper'
import { asyncHandler } from "../utils/asyncHandler"

const upload = multer({ storage: multer.memoryStorage() })

const publicApiRouter: Router = router()

publicApiRouter.post("/invitation/accept", upload.single('avatar'), asyncHandler(async (req: Request, res: Response) => {
    if (req.file) {
        req.body.avatar = await fileToBase64String(req.file)
    }
    const result = await userApi.acceptInvitation(req.body)
    res.status(200).json(result)
}))

publicApiRouter.post("/askreset", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.askResetPassword(req.body)
    res.status(200).json(result)
}))

publicApiRouter.post("/reset", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.resetPassword(req.body)
    res.status(200).json(result)
}))

export default publicApiRouter
