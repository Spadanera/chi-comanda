import router, { Router, Request, Response } from "express"
import eventAPI from "../api/event"
import orderAPI from "../api/order"
import tableApi from "../api/table"
import itemApi from "../api/item"
import masterItemsApi from "../api/master-item"
import masterTableApi from "../api/master-table"
import { CompleteOrderInput } from "../../../models/src"

const apiRouter: Router = router()

// events API
apiRouter.get("/events", async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/ongoing", async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.getOnGoing()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/:id", async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.get(+req.params.id)
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

apiRouter.post("/events", async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/events/:id", async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/events/:id", async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/:id/tables/available", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getAvailableTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/:id/tables", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getActiveTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// table API
apiRouter.get("/tables", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/tables/:id", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.get(+req.params.id)
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

apiRouter.post("/tables", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/tables/:id", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/tables/:id/payitems", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.paySelectedItem(+req.params.id, req.body as number[])
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/tables/:id", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/tables/:id/close", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.closeTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// orders API
apiRouter.get("/orders/:eventid/:destinationsids", async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.getAll(+req.params.eventid, JSON.parse(req.params.destinationsids))
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/orders/:id", async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.get(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/orders", async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/orders/:id", async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/orders/:id", async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// order items API
apiRouter.get("/orders/:id/items", async (req: Request, res: Response) => {
    try {
        const result = await itemApi.getByOrderId(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/orders/:order_id/complete", async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.completeOrder(+req.params.order_id, req.body as CompleteOrderInput)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/tables/:id/items", async (req: Request, res: Response) => {
    try {
        const result = await itemApi.getByTableId(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/tables/:id/complete", async (req: Request, res: Response) => {
    try {
        const result = await tableApi.closeTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/items/:id", async (req: Request, res: Response) => {
    try {
        const result = await itemApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/items", async (req: Request, res: Response) => {
    try {
        const result = await itemApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// master items API
apiRouter.get("/master-items", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/master-items/available", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getAllAvailable()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/master-items/:id", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.get(+req.params.id)
        res.status(200).json(result[0])
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/master-items", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/master-items", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/master-items/:id", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// master tables API
apiRouter.get("/master-tables", async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/master-tables/:id", async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.get(+req.params.id)
        if (result && result.length) {
            res.status(200).json(result[0])
        }
        else {
            res.status(200).json(0)
        }
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/master-tables", async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/master-tables", async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

export default apiRouter