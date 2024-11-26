import router, { Router, Request, Response } from "express"
import masterItemsApi from "../api/master-item"
import { authorizationMiddleware, Roles } from "../utils/helper"

const subTypesRouter: Router = router()

subTypesRouter.get("/", authorizationMiddleware([Roles.admin, Roles.bartender, Roles.checkout, Roles.waiter]), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getSubTypes()
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

subTypesRouter.post("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.createSubTypes(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

subTypesRouter.put("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.updateSubTypes(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

subTypesRouter.delete("/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.deleteSubtypes(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default subTypesRouter