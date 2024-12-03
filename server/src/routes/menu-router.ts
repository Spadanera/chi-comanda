import router, { Router, Request, Response } from "express"
import masterItemsApi from "../api/master-item"

const menuRouter: Router = router()

menuRouter.get("/", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.getAllMenu()
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

menuRouter.post("/", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.createMenu(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

menuRouter.put("/", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.editMenu(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

menuRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        const result = await masterItemsApi.deleteMenu(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default menuRouter