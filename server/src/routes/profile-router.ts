import router, { Router, Request, Response } from "express"
import profileApi from "../api/profile"
import multer from 'multer'
import { User } from "../../../models/src"
import { fileToBase64String } from '../utils/helper'
import { asyncHandler } from "../utils/asyncHandler"

const upload = multer({ storage: multer.memoryStorage() })

export const authorizationMiddleware = () => (req: Request, res: Response, next: any) => {
    const userId = (req.user as any).id
    const reqId = req.params.id || req.body.id
    if (+reqId === +userId) {
        next()
    } else {
        res.status(401).json('Unauthorized')
    }
}

const profileRouter: Router = router()

profileRouter.get("/:id", authorizationMiddleware(), asyncHandler(async (req: Request, res: Response) => {
    const result = await profileApi.get(+req.params.id)
    res.status(200).json(result)
}))

profileRouter.put("/avatar/:id", authorizationMiddleware(), upload.single('avatar'), asyncHandler(async (req: Request, res: Response) => {
    if (req.file) {
        const avatar = await fileToBase64String(req.file)
        await profileApi.updateAvatar({ avatar, id: +req.params.id } as User);
        (req.user as User).avatar = avatar
        res.status(200).json(avatar)
    } else {
        res.status(404).json('Missing image')
    }
}))

profileRouter.put("/username", authorizationMiddleware(), asyncHandler(async (req: Request, res: Response) => {
    const result = await profileApi.updateUsername(req.body);
    (req.user as User).username = req.body.username
    res.status(200).json(result)
}))

export default profileRouter
