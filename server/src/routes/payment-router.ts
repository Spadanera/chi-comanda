import router, { Router, Request, Response } from 'express'
import paymentApi from '../api/payment'
import { authorizationMiddleware, Roles } from '../utils/helper'
import { asyncHandler } from '../utils/asyncHandler'

const paymentRouter: Router = router()

// ── Settings (admin) ─────────────────────────────────────────────────────────

paymentRouter.get(
    '/settings',
    authorizationMiddleware(Roles.admin),
    asyncHandler(async (_req: Request, res: Response) => {
        const result = await paymentApi.getSettings()
        res.status(200).json(result)
    })
)

paymentRouter.post(
    '/settings',
    authorizationMiddleware(Roles.admin),
    asyncHandler(async (req: Request, res: Response) => {
        const result = await paymentApi.saveSettings(req.body)
        res.status(200).json(result)
    })
)

// ── Provider discovery (checkout operator) ───────────────────────────────────

paymentRouter.get(
    '/available',
    authorizationMiddleware(Roles.checkout),
    asyncHandler(async (_req: Request, res: Response) => {
        const result = await paymentApi.getAvailableProviders()
        res.status(200).json(result)
    })
)

// ── sumup_checkout – link / QR code ──────────────────────────────────────────

paymentRouter.post(
    '/checkout/sumup-checkout',
    authorizationMiddleware(Roles.checkout),
    asyncHandler(async (req: Request, res: Response) => {
        const { table_id, event_id, amount, item_ids, description } = req.body
        const result = await paymentApi.createCheckoutLink(
            +table_id, +event_id, +amount, item_ids || [],
            description || 'Pagamento tavolo'
        )
        res.status(200).json(result)
    })
)

// ── sumup_pos – URL scheme (app SumUp su tablet) ─────────────────────────────

paymentRouter.post(
    '/checkout/sumup-pos',
    authorizationMiddleware(Roles.checkout),
    asyncHandler(async (req: Request, res: Response) => {
        const { table_id, event_id, amount, item_ids, description } = req.body
        const result = await paymentApi.createPosSession(
            +table_id, +event_id, +amount, item_ids || [],
            description || 'Pagamento tavolo'
        )
        res.status(200).json(result)
    })
)

// ── sumup_solo – terminale standalone ────────────────────────────────────────

paymentRouter.post(
    '/checkout/sumup-solo',
    authorizationMiddleware(Roles.checkout),
    asyncHandler(async (req: Request, res: Response) => {
        const { table_id, event_id, amount, item_ids, description } = req.body
        const result = await paymentApi.createSoloPayment(
            +table_id, +event_id, +amount, item_ids || [],
            description || 'Pagamento tavolo'
        )
        res.status(200).json(result)
    })
)

// ── Status check (sumup_checkout e sumup_solo – polling) ─────────────────────

paymentRouter.get(
    '/checkout/:id/status',
    authorizationMiddleware(Roles.checkout),
    asyncHandler(async (req: Request, res: Response) => {
        const result = await paymentApi.checkTransactionStatus(+req.params.id)
        res.status(200).json(result)
    })
)

export default paymentRouter
