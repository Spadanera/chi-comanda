import router, { Router, Request, Response } from "express"
import userApi from "../api/user"

const userRouter: Router = router()

userRouter.get("/", async (req: Request, res: Response) => {
    try {
        const result = await userApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

userRouter.put("/", async (req: Request, res: Response) => {
    try {
        const result = await userApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

userRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        const result = await userApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

userRouter.put("/roles", async (req: Request, res: Response) => {
    try {
        const result = await userApi.updateRoles(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

userRouter.post("/invite", async (req: Request, res: Response) => {
    try {
        const result = await userApi.inviteUser(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default userRouter