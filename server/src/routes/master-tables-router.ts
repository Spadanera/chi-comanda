import router, { Router, Request, Response } from "express"
import masterTableApi from "../api/master-table"
import { authorizationMiddleware, Roles } from "../utils/helper"

const masterTableRouter: Router = router()

masterTableRouter.get("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

masterTableRouter.get("/:id", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout, Roles.admin]), async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.get(+req.params.id)
        if (result && result.length) {
            res.status(200).json(result[0])
        }
        else {
            res.status(200).json(0)
        }
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

masterTableRouter.post("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

masterTableRouter.put("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default masterTableRouter