import { Request, Router } from 'express'
import paymentService, { PaymentRequest } from '../services/payment'
import { jsonHandler, requireRole, Roles } from '../http/middleware'
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

router.get('/settings', admin, jsonHandler(() => paymentService.getSettings()))
router.post('/settings', admin, jsonHandler(req => paymentService.saveSettings(req.body)))

router.get('/available', checkout, jsonHandler(() => paymentService.getAvailableProviders()))

router.post('/checkout/sumup-checkout', checkout, jsonHandler(req => paymentService.createCheckoutLink(toPaymentRequest(req))))
router.post('/checkout/sumup-pos', checkout, jsonHandler(req => paymentService.createPosSession(toPaymentRequest(req))))
router.post('/checkout/sumup-solo', checkout, jsonHandler(req => paymentService.createSoloPayment(toPaymentRequest(req))))

router.get('/checkout/:id/status', checkout, jsonHandler(req => paymentService.checkTransactionStatus(toId(req.params.id))))

export default router
