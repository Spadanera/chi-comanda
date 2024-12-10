import router, { Router, Request, Response } from "express"
import userApi from "../api/user"

const userPublicRouter: Router = router()

userPublicRouter.get("/avatar/:id", async (req: Request, res: Response) => {
    try {
        const result = await userApi.getAvatar(+req.params.id)
        res.set('Cache-Control', 'public, max-age=86400')
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default userPublicRouter