import sharp from 'sharp'

/** Resizes an uploaded avatar to 200x200 and returns it as a data URI. */
export async function avatarToDataUri(file: Express.Multer.File): Promise<string> {
    const optimized = await sharp(file.buffer)
        .resize({ width: 200, height: 200 })
        .toBuffer()
    return `data:${file.mimetype};base64,${optimized.toString('base64')}`
}
