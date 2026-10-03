import { NextFunction, Request, Response, Router } from 'express'
import multer from 'multer'
import profileService from '../services/profile'
import { asyncHandler, currentUserId, jsonHandler } from '../http/middleware'
import { BadRequestError, ForbiddenError } from '../http/errors'
import { toId } from '../http/validate'
import { avatarToDataUri } from '../utils/image'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

/** Users can only read and edit their own profile. */
const ownProfileOnly = (req: Request, _res: Response, next: NextFunction) => {
    const requestedId = req.params.id || req.body?.id
    next(Number(requestedId) === currentUserId(req) ? undefined : new ForbiddenError())
}

const router = Router()

router.put('/avatar/:id', ownProfileOnly, upload.single('avatar'), asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new BadRequestError('Immagine mancante')
    }
    const avatar = await avatarToDataUri(req.file)
    await profileService.updateAvatar(toId(req.params.id), avatar)
    res.status(200).json(avatar)
}))

router.put('/username', ownProfileOnly, jsonHandler(req => profileService.updateUsername(currentUserId(req), req.body.username)))

export default router
