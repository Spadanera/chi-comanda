import { Router } from 'express'
import multer from 'multer'
import userService from '../services/user'
import paymentService from '../services/payment'
import { asyncHandler, jsonHandler } from '../http/middleware'
import { toId } from '../http/validate'
import { avatarToDataUri } from '../utils/image'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

/** Endpoints reachable without a session. */
const router = Router()

router.post('/invitation/accept', upload.single('avatar'), jsonHandler(async req => {
    if (req.file) {
        req.body.avatar = await avatarToDataUri(req.file)
    }
    return userService.acceptInvitation(req.body)
}))

router.post('/askreset', jsonHandler(req => userService.askResetPassword(req.body.email)))

router.post('/reset', jsonHandler(req => userService.resetPassword(req.body)))

/** Called by the SumUp app once a POS payment ends; authenticated by the `sig` query parameter. */
router.get('/payment/sumup/pos-callback', asyncHandler(async (req, res) => {
    await paymentService.handlePosCallback(
        toId(req.query.tx_id, 'tx_id'),
        String(req.query.sig || ''),
        String(req.query['smp-status'] || ''),
        req.query['smp-tx-code'] ? String(req.query['smp-tx-code']) : undefined,
    )
    // SumUp only needs a 200 to consider the callback delivered
    res.status(200).send('OK')
}))

export default router
