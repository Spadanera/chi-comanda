import router, { Router, Request, Response } from "express"
import userApi from "../api/user"
import multer from 'multer'
import { fileToBase64String} from '../utils/helper'

const upload = multer({ storage: multer.memoryStorage() })

const publicApiRouter: Router = router()

publicApiRouter.post("/invitation/accept", upload.single('avatar'), async (req: Request, res: Response) => {
    try {
        if (req.file) {
            req.body.avatar = await fileToBase64String(req.file)
        }
        const result = await userApi.acceptInvitation(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

publicApiRouter.post("/askreset", async (req: Request, res: Response) => {
    try {
        const result = await userApi.askResetPassword(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

publicApiRouter.post("/reset", async (req: Request, res: Response) => {
    try {
        const result = await userApi.resetPassword(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default publicApiRouter