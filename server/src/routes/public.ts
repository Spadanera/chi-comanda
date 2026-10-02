import router, { Router, Request, Response } from "express"
import userApi from "../api/user"
import multer from 'multer'
import { fileToBase64String } from '../utils/helper'
import { asyncHandler } from "../utils/asyncHandler"

const upload = multer({ storage: multer.memoryStorage() })

const publicApiRouter: Router = router()

publicApiRouter.post("/invitation/accept", upload.single('avatar'), asyncHandler(async (req: Request, res: Response) => {
    if (req.file) {
        req.body.avatar = await fileToBase64String(req.file)
    }
    const result = await userApi.acceptInvitation(req.body)
    res.status(200).json(result)
}))

publicApiRouter.post("/askreset", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.askResetPassword(req.body)
    res.status(200).json(result)
}))

publicApiRouter.post("/reset", asyncHandler(async (req: Request, res: Response) => {
    const result = await userApi.resetPassword(req.body)
    res.status(200).json(result)
}))

// ── SumUp POS callback (chiamato dall'app SumUp dopo il pagamento) ────────────
// Rotta pubblica: nessuna autenticazione richiesta (la chiama SumUp, non l'utente)
publicApiRouter.get('/payment/sumup/pos-callback', asyncHandler(async (req: Request, res: Response) => {
    const tx_id = parseInt(req.query['tx_id'] as string, 10)
    const smpStatus = (req.query['smp-status'] as string) || ''
    const smpTxCode = (req.query['smp-tx-code'] as string) || undefined

    if (!tx_id || isNaN(tx_id)) {
        return res.status(400).send('tx_id mancante')
    }

    const paymentApi = (await import('../api/payment')).default
    await paymentApi.handlePosCallback(tx_id, smpStatus, smpTxCode)

    // SumUp si aspetta una risposta 200 per considerare il callback andato a buon fine
    res.status(200).send('OK')
}))

export default publicApiRouter
