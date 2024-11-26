import router, { Router, Request, Response } from "express"
import masterItemsApi from "../api/master-item"
import { authorizationMiddleware, Roles } from "../utils/helper"

const masterItemsRouter: Router = router()

masterItemsRouter.get("/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getAll(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

masterItemsRouter.get("/available/:id", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getAllAvailable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

masterItemsRouter.post("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

masterItemsRouter.put("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

masterItemsRouter.delete("/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default masterItemsRouter