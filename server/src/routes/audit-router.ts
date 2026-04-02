import router, { Router, Request, Response } from "express"
import auditApi from "../api/audit"
import { asyncHandler } from "../utils/asyncHandler"

const auditRouter: Router = router()

auditRouter.get("/", asyncHandler(async (req: Request, res: Response) => {
    const result = await auditApi.get(
        +(req.query.page || 1),
        +(req.query.itemsperpage || 25),
        req.query.sortby?.toString(),
        req.query.sortdir?.toString()
    )
    res.status(200).json(result)
}))

export default auditRouter
