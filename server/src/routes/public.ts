import router, { Router, Request, Response } from "express"
import userApi from "../api/user"

const apiRouter: Router = router()

apiRouter.post("/users/invitation/accept", async (req: Request, res: Response) => {
    try {
        const result = await userApi.acceptInvitation(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/users/askreset", async (req: Request, res: Response) => {
    try {
        const result = await userApi.askResetPassword(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/users/reset", async (req: Request, res: Response) => {
    try {
        const result = await userApi.resetPassword(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

export default apiRouter