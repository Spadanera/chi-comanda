import { Router } from 'express'
import multer from 'multer'
import settingsService from '../services/settings'
import { jsonHandler } from '../http/middleware'
import { BadRequestError } from '../http/errors'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

/** Branding of the installation (admin). */
const router = Router()

router.get('/', jsonHandler(() => settingsService.get()))

router.put('/', jsonHandler(req => settingsService.update(req.body || {})))

router.put('/logo', upload.single('logo'), jsonHandler(async req => {
    if (!req.file) throw new BadRequestError('Logo mancante')
    await settingsService.setLogo(req.file.buffer)
    return settingsService.get()
}))

router.delete('/logo', jsonHandler(async () => {
    await settingsService.deleteLogo()
    return settingsService.get()
}))

export default router
