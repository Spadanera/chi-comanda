import { Router } from 'express'
import multer from 'multer'
import settingsService from '../services/settings'
import { jsonHandler } from '../http/middleware'
import { ctx } from '../venue/context'
import { BadRequestError } from '../http/errors'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

/** Branding of the venue the admin works in. */
const router = Router()

router.get('/', jsonHandler(req => settingsService.get(ctx(req))))

router.put('/', jsonHandler(req => settingsService.update(ctx(req), req.body || {})))

router.put('/logo', upload.single('logo'), jsonHandler(async req => {
    if (!req.file) throw new BadRequestError('Logo mancante')
    await settingsService.setLogo(ctx(req), req.file.buffer)
    return settingsService.get(ctx(req))
}))

router.delete('/logo', jsonHandler(async req => {
    await settingsService.deleteLogo(ctx(req))
    return settingsService.get(ctx(req))
}))

export default router
