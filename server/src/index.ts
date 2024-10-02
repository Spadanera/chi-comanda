import express, { Express, Request, Response } from "express"
import EventAPI from "./api/event"
import OrderAPI from "./api/order"
import TableApi from "./api/table"

const app: Express = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// events API
app.get("/api/events", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.get("/api/events/:id", async (req: Request, res: Response) => {
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

app.post("/api/events", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.put("/api/events/:id", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.delete("/api/events/:id", async (req: Request, res: Response) => {
    try {
        const api = new EventAPI()
        const result = await api.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// table API
app.get("/api/tables", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.get("/api/tables/:id", async (req: Request, res: Response) => {
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

app.post("/api/tables", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.put("/api/tables/:id", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.delete("/api/tables/:id", async (req: Request, res: Response) => {
    try {
        const api = new TableApi()
        const result = await api.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

// orders API
app.get("/api/orders/:eventid", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.getAll(+req.params.eventid)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.get("/api/orders/:id", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.get(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.post("/api/orders", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.put("/api/orders/:id", async (req: Request, res: Response) => {
    try {
        const api = new OrderAPI()
        const result = await api.update(req.body, +req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

app.delete("/api/orders/:id", async (req: Request, res: Response) => {
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
app.get("/api/orders/:id/items", async (req: Request, res: Response) => {
    res.status(200).json("Hello from the server!!!")
})

app.delete("/api/orders/:id/items/:itemid", async (req: Request, res: Response) => {
    res.status(200).json("Hello from the server!!!")
})

app.put("/api/orders/:id/items/:itemid", async (req: Request, res: Response) => {
    res.status(200).json("Hello from the server!!!")
})

app.delete("/api/orders/:id/items/:itemid", async (req: Request, res: Response) => {
    res.status(200).json("Hello from the server!!!")
})

// start listening

app.listen(3000, () => {
    console.log(`App is listening on port 3000`)
})