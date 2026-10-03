import { Request, Router } from 'express'
import { User } from '../../../models/src'
import multer from 'multer'
import userService from '../services/user'
import paymentService from '../services/payment'
import settingsService, { LOGO_SIZES, LogoSize } from '../services/settings'
import { asyncHandler, jsonHandler, requireFeature } from '../http/middleware'
import { toId } from '../http/validate'
import { NotFoundError } from '../http/errors'
import { avatarToDataUri } from '../utils/image'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

/** Endpoints reachable without a session. */
const router = Router()

/** Venue chosen in the session, if any: public pages show its branding. */
const sessionVenue = (req: Request) => (req.user as User | undefined)?.venueId

/** Read by the client at startup: venue name, active functions, branding. */
router.get('/config', jsonHandler(req => settingsService.publicConfig(sessionVenue(req))))

router.get('/manifest.webmanifest', asyncHandler(async (req, res) => {
    res.type('application/manifest+json').send(JSON.stringify(await settingsService.manifest(sessionVenue(req))))
}))

router.get('/logo/:size.png', asyncHandler(async (req, res) => {
    if (!(req.params.size in LOGO_SIZES)) throw new NotFoundError()
    const requested = req.query.venue === undefined ? undefined : Number(req.query.venue)
    const png = await settingsService.logo(sessionVenue(req), req.params.size as LogoSize, requested)
    if (!png) throw new NotFoundError()
    // The URL carries the version (?v=), so a new logo gets a new URL
    res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache')
    res.type('png').send(png)
}))

router.post('/invitation/accept', upload.single('avatar'), jsonHandler(async req => {
    if (req.file) {
        req.body.avatar = await avatarToDataUri(req.file)
    }
    return userService.acceptInvitation(req.body)
}))

router.post('/askreset', jsonHandler(req => userService.askResetPassword(req.body.email)))

router.post('/reset', jsonHandler(req => userService.resetPassword(req.body)))

/** Called by the SumUp app once a POS payment ends; authenticated by the `sig` query parameter. */
router.get('/payment/sumup/pos-callback', requireFeature('payments'), asyncHandler(async (req, res) => {
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
