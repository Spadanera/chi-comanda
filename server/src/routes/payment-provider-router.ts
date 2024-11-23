import router, { Router, Request, Response } from "express"
import paymentProviderApi from "../api/paymentProvider"

const paymentProviderRouter: Router = router()

paymentProviderRouter.get("/", async (req: Request, res: Response) => {
    try {
        const result = await paymentProviderApi.getAll()
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

paymentProviderRouter.post("/", async (req: Request, res: Response) => {
    try {
        const result = await paymentProviderApi.create(req.body)
        res.status(200).json(result)
    } catch (error) {
        console.log(error)
        res.status(500).json(error)
    }
})

export default paymentProviderRouter