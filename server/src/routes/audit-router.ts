import router, { Router, Request, Response } from "express"
import auditApi from "../api/audit"

const auditRouter: Router = router()

auditRouter.get("/", async (req: Request, res: Response) => {
    try {
        const result = await auditApi.get(+(req.query.page || 1), +(req.query.itemsperpage || 25), req.query.sortby?.toString(), req.query.sortdir?.toString())
        res.status(200).json(result)
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})

export default auditRouter