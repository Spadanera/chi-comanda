import { Request, Router } from 'express'
import paymentService, { PaymentRequest } from '../services/payment'
import { jsonHandler, requireRole, Roles } from '../http/middleware'
import { ctx } from '../venue/context'
import { idempotentHandler } from '../http/idempotency'
import { toId, toIdList, toPositiveAmount } from '../http/validate'

function toPaymentRequest(req: Request): PaymentRequest {
    const { table_id, event_id, amount, item_ids, description } = req.body || {}
    return {
        table_id: toId(table_id, 'table_id'),
        event_id: toId(event_id, 'event_id'),
        amount: toPositiveAmount(amount),
        item_ids: toIdList(item_ids || [], 'item_ids'),
        description: typeof description === 'string' && description ? description : 'Pagamento tavolo',
    }
}

const router = Router()
const admin = requireRole(Roles.admin)
const checkout = requireRole(Roles.checkout)

router.get('/settings', admin, jsonHandler(req => paymentService.getSettings(ctx(req))))
router.post('/settings', admin, jsonHandler(req => paymentService.saveSettings(ctx(req), req.body)))

router.get('/available', checkout, jsonHandler(req => paymentService.getAvailableProviders(ctx(req))))

router.post('/checkout/sumup-checkout', checkout, idempotentHandler((req, c) => paymentService.createCheckoutLink(c, toPaymentRequest(req))))
router.post('/checkout/sumup-pos', checkout, idempotentHandler((req, c) => paymentService.createPosSession(c, toPaymentRequest(req))))
router.post('/checkout/sumup-solo', checkout, idempotentHandler((req, c) => paymentService.createSoloPayment(c, toPaymentRequest(req))))

router.get('/checkout/:id/status', checkout, jsonHandler(req => paymentService.checkTransactionStatus(ctx(req), toId(req.params.id))))

export default router
