import router, { Router, Request, Response } from "express"
import masterItemsApi from "../api/master-item"

const typesRouter: Router = router()

typesRouter.get("/", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getTypes()
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

typesRouter.post("/", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.createType(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

typesRouter.put("/", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.updateType(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

typesRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.deleteType(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default typesRouter