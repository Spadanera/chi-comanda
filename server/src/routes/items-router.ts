import router, { Router, Request, Response } from "express"
import itemApi from "../api/item"

const itemsRouter: Router = router()

itemsRouter.delete("/:id", async (req: Request, res: Response) => {
    try {
        const result = await itemApi.delete(+req.params.id)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

itemsRouter.put("/", async (req: Request, res: Response) => {
    try {
        const result = await itemApi.update(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default itemsRouter