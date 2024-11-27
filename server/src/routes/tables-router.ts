import router, { Router, Request, Response } from "express"
import tableApi from "../api/table"
import { authorizationMiddleware, Roles } from "../utils/helper"

const tablesRouter: Router = router()

tablesRouter.put("/:id/change/:masterid", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.changeTable(+req.params.id, +req.params.masterid)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

tablesRouter.get("/", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

tablesRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.get(+req.params.id)
        if (result.length) {
            res.status(200).json(result[0])
        }
        else {
            res.status(400).json('Resource not found')
        }
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

tablesRouter.post("/", async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any).id
        const result = await tableApi.create(req.body, +userId)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

tablesRouter.put("/:id", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

tablesRouter.put("/:id/payitems", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.paySelectedItem(+req.params.id, req.body as number[])
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

tablesRouter.put("/:id/complete", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.closeTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default tablesRouter