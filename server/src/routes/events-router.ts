import router, { Router, Request, Response } from "express"
import eventApi from "../api/event"
import tableApi from "../api/table"
import { authorizationMiddleware, Roles } from "../utils/helper"

const eventsRouter: Router = router()

eventsRouter.get("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await eventApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.get("/ongoing", async (req: Request, res: Response) => {
    try {
        const result = await eventApi.getOnGoing()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.get("/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await eventApi.get(+req.params.id)
        if (result.length) {
            res.status(200).json(result[0])
        }
        else {
            res.status(400).json('Resource not found')
        }
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.post("/", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await eventApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.put("/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await eventApi.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.delete("/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await eventApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.get("/:id/tables/available", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getAvailableTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.get("/:id/tables/free", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getFreeTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.get("/:id/tables", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getActiveTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

eventsRouter.post("/:eventid/tables/:tableid/discount/:discount", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.insertDiscount(+req.params.eventid, +req.params.tableid, +req.params.discount)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

export default eventsRouter