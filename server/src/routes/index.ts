import router, { Router, Request, Response } from "express"
import EventAPI from "../api/event"
import OrderAPI from "../api/order"
import TableApi from "../api/table"
import ItemApi from "../api/item"
import MasterItemsApi from "../api/master-item"
import MasterTableApi from "../api/master-table"
import { CompleteOrderInput } from "../../../models/src"

const apiRouter: Router = router()

// events API
apiRouter.get("/events", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/ongoing", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.getOnGoing()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/:id", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.get(+req.params.id)
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
        const api = new EventAPI()
        const result = await api.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/events/:id", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/events/:id", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/:id/tables/available", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.getAvailableTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/:id/tables", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.getActiveTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// table API
apiRouter.get("/tables", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/tables/:id", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.get(+req.params.id)
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
        const api = new TableApi()
        const result = await api.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/tables/:id", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/tables/:id", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/tables/:id/close", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.closeTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// orders API
apiRouter.get("/orders/:eventid/:destinationsids", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.getAll(+req.params.eventid, JSON.parse(req.params.destinationsids))
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/orders/:id", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.get(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/orders", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/orders/:id", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/orders/:id", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// order items API
apiRouter.get("/orders/:id/items", async (req: Request, res: Response) => {
    try {
        const api = new ItemApi()
        const result = await api.getByOrderId(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/orders/:order_id/complete", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.completeOrder(+req.params.order_id, req.body as CompleteOrderInput)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/tables/:id/items", async (req: Request, res: Response) => {
    try {
        const api = new ItemApi()
        const result = await api.getByTableId(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/tables/:id/complete", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.closeTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/orders/:id/items/:itemid", async (req: Request, res: Response) => {
    try {
        const api = new ItemApi()
        const result = await api.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/items", async (req: Request, res: Response) => {
    try {
        const api = new ItemApi()
        const result = await api.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// master items API
apiRouter.get("/master-items", async (req: Request, res: Response) => {
    try {
        const api = new MasterItemsApi()
        const result = await api.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/master-items/available", async (req: Request, res: Response) => {
    try {
        const api = new MasterItemsApi()
        const result = await api.getAllAvailable()
        res.status(200).json(result[0])
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/master-items/:id", async (req: Request, res: Response) => {
    try {
        const api = new MasterItemsApi()
        const result = await api.get(+req.params.id)
        res.status(200).json(result[0])
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/master-items", async (req: Request, res: Response) => {
    try {
        const api = new MasterItemsApi()
        const result = await api.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/master-items/:id", async (req: Request, res: Response) => {
    try {
        const api = new MasterItemsApi()
        const result = await api.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/master-items/:id", async (req: Request, res: Response) => {
    try {
        const api = new MasterItemsApi()
        const result = await api.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// master tables API
apiRouter.get("/master-tables", async (req: Request, res: Response) => {
    try {
        const api = new MasterTableApi()
        const result = await api.getAll()
        res.status(200).json(result[0])
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/master-tables/:id", async (req: Request, res: Response) => {
    try {
        const api = new MasterTableApi()
        const result = await api.get(+req.params.id)
        res.status(200).json(result[0])
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/master-tables", async (req: Request, res: Response) => {
    try {
        const api = new MasterTableApi()
        const result = await api.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/master-tables/:id", async (req: Request, res: Response) => {
    try {
        const api = new MasterTableApi()
        const result = await api.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/master-tables/:id", async (req: Request, res: Response) => {
    try {
        const api = new MasterTableApi()
        const result = await api.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

export default apiRouter