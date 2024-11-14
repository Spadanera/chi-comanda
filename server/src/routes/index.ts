import router, { Router, Request, Response } from "express"
import eventAPI from "../api/event"
import orderAPI from "../api/order"
import tableApi from "../api/table"
import itemApi from "../api/item"
import masterItemsApi from "../api/master-item"
import masterTableApi from "../api/master-table"
import userApi from "../api/user"
import destinationApi from "../api/destination"
import { CompleteOrderInput } from "../../../models/src"
import publicApiRouter from "./public"
import { Roles, authorizationMiddleware } from "../utils/helper"

const apiRouter: Router = router()

// events API
apiRouter.get("/events", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
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

apiRouter.get("/events/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
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

apiRouter.post("/events", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/events/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/events/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await eventAPI.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/:id/tables/available", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getAvailableTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/events/:id/tables/free", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.getFreeTable(+req.params.id)
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

apiRouter.post("/events/:eventid/tables/:tableid/discount/:discount", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.insertDiscount(+req.params.eventid, +req.params.tableid, +req.params.discount)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/tables/:id/change/:masterid", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.changeTable(+req.params.id, +req.params.masterid)
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

apiRouter.put("/tables/:id", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/tables/:id/payitems", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.paySelectedItem(+req.params.id, req.body as number[])
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// orders API
apiRouter.get("/orders/:eventid/:destinationsids", authorizationMiddleware(Roles.bartender), async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.getAll(+req.params.eventid, JSON.parse(req.params.destinationsids))
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/orders", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// order items API
apiRouter.get("/orders/:id/items", authorizationMiddleware([Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await itemApi.getByOrderId(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/orders/:order_id/complete", authorizationMiddleware(Roles.bartender), async (req: Request, res: Response) => {
    try {
        const result = await orderAPI.completeOrder(+req.params.order_id, req.body as CompleteOrderInput)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/tables/:id/complete", authorizationMiddleware(Roles.checkout), async (req: Request, res: Response) => {
    try {
        const result = await tableApi.closeTable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/items/:id", authorizationMiddleware([Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await itemApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/items", authorizationMiddleware([Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await itemApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// master items API
apiRouter.get("/menu", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getAllMenu()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/menu", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.createMenu(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/menu", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.editMenu(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/menu/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.deleteMenu(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})


apiRouter.get("/master-items/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getAll(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/master-items/available/:id", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout]), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getAllAvailable(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/master-items", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/master-items", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/master-items/:id", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// master tables API
apiRouter.get("/master-tables", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/master-tables/:id", authorizationMiddleware([Roles.waiter, Roles.bartender, Roles.checkout, Roles.admin]), async (req: Request, res: Response) => {
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

apiRouter.post("/master-tables", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/master-tables", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await masterTableApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// destination API
apiRouter.get("/destinations", async (req: Request, res: Response) => {
    try {
        const result = await destinationApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/destinations", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await destinationApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/destinations", authorizationMiddleware(Roles.admin), async (req: Request, res: Response) => {
    try {
        const result = await destinationApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.get("/users", authorizationMiddleware(Roles.superuser), async (req: Request, res: Response) => {
    try {
        const result = await userApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/users", authorizationMiddleware(Roles.superuser), async (req: Request, res: Response) => {
    try {
        const result = await userApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.delete("/users/:id", authorizationMiddleware(Roles.superuser), async (req: Request, res: Response) => {
    try {
        const result = await userApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.put("/users/roles", authorizationMiddleware(Roles.superuser), async (req: Request, res: Response) => {
    try {
        const result = await userApi.updateRoles(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.post("/users/invite", authorizationMiddleware(Roles.superuser), async (req: Request, res: Response) => {
    try {
        const result = await userApi.inviteUser(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

apiRouter.use("/public", publicApiRouter)

export default apiRouter