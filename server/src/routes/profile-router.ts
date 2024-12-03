import router, { Router, Request, Response } from "express"
import profileApi from "../api/profile"
import multer from 'multer'
import { User } from "../../../models/src"
import { fileToBase64String} from '../utils/helper'

const upload = multer({ storage: multer.memoryStorage() })

export const authorizationMiddleware = () => (req: Request, res: Response, next: any) => {
    const userId = (req.user as any).id
    const reqId = req.params.id || req.body.id
    if (+reqId === +userId) {
        next()
    }
    else {
        res.status(401).json('Unauthorized')
    }
}

const profileRouter: Router = router()

profileRouter.get("/:id", authorizationMiddleware(), async (req: Request, res: Response) => {
    try {
        const result = await profileApi.get(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

profileRouter.put("/avatar/:id", authorizationMiddleware(), upload.single('avatar'), async (req: Request, res: Response) => {
    try {
        let avatar
        if (req.file) {
            avatar = await fileToBase64String(req.file)
            await profileApi.updateAvatar({
                avatar, id: +req.params.id
            } as User);

            (req.user as User).avatar = avatar
            res.status(200).json(avatar)
        }
        else {
            res.status(404).json('Missing image')
        }
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

profileRouter.put("/username", authorizationMiddleware(), async (req: Request, res: Response) => {
    try {
        const result = await profileApi.updateUsername(req.body);
        (req.user as User).username = req.body.username
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default profileRouter