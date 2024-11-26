import router, { Router, Request, Response } from "express"
import destinationApi from "../api/destination"
import { authorizationMiddleware, Roles } from "../utils/helper"

const destinationsRouter: Router = router()

destinationsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const result = await destinationApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

destinationsRouter.post("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await destinationApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

destinationsRouter.put("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await destinationApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default destinationsRouter