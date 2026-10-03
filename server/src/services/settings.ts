import sharp from 'sharp'
import db from '../db'
import config, { isFeatureEnabled } from '../config'
import { FEATURES } from '../features'
import { isGoogleEnabled } from '../auth/passport'
import { BadRequestError } from '../http/errors'
import type { PublicConfig, Settings } from '../../../models/src'


export const LOGO_SIZES = { '192': 192, '512': 512, 'maskable': 512 } as const
export type LogoSize = keyof typeof LOGO_SIZES

/** Background of the maskable icon, around the logo: the cream of the default light theme. */
const MASKABLE_BACKGROUND = '#EFE5D2'
const COLOR = /^#[0-9a-fA-F]{6}$/

interface Row {
    venue_name: string | null
    primary_color: string | null
    secondary_color: string | null
    has_logo: number
    version: number
}

function toColor(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === '') return null
    if (typeof value !== 'string' || !COLOR.test(value)) {
        throw new BadRequestError(`Colore non valido: ${field}`)
    }
    return value.toUpperCase()
}

class SettingsService {
    private async row(): Promise<Row> {
        const row = await db.queryOne<Row>(`
            SELECT venue_name, primary_color, secondary_color, logo IS NOT NULL has_logo,
                UNIX_TIMESTAMP(updated_at) version
            FROM settings WHERE id = 1`)
        // The row is created by the migration; an empty one means "all defaults"
        return row || { venue_name: null, primary_color: null, secondary_color: null, has_logo: 0, version: 0 }
    }

    private venueName(row: Row): string | null {
        return row.venue_name || config.client.name || null
    }

    /** Versioned, so browsers can cache it forever and still see a new logo. */
    private logoUrl(row: Row, size: LogoSize): string {
        return `/api/public/logo/${size}.png?v=${row.version}`
    }

    async get(): Promise<Settings> {
        const { venue_name, primary_color, secondary_color, has_logo } = await this.row()
        return { venue_name, primary_color, secondary_color, has_logo: !!has_logo }
    }

    async update(input: Partial<Settings>): Promise<Settings> {
        const name = typeof input.venue_name === 'string' ? input.venue_name.trim() : ''
        if (name.length > 100) {
            throw new BadRequestError('Nome del locale troppo lungo (massimo 100 caratteri)')
        }
        await db.execute(
            'UPDATE settings SET venue_name = ?, primary_color = ?, secondary_color = ? WHERE id = 1',
            [name || null, toColor(input.primary_color, 'primario'), toColor(input.secondary_color, 'secondario')])
        return this.get()
    }

    /** Stores the uploaded image as a 512x512 PNG (transparent margins). */
    async setLogo(file: Buffer): Promise<void> {
        let png: Buffer
        try {
            png = await sharp(file)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toBuffer()
        } catch {
            throw new BadRequestError('Immagine non valida')
        }
        await db.execute('UPDATE settings SET logo = ? WHERE id = 1', [png])
    }

    async deleteLogo(): Promise<void> {
        await db.execute('UPDATE settings SET logo = NULL WHERE id = 1')
    }

    /** The logo as a PNG of the given size, undefined when there is none. */
    async logo(size: LogoSize): Promise<Buffer | undefined> {
        const row = await db.queryOne<{ logo: Buffer | null }>('SELECT logo FROM settings WHERE id = 1')
        if (!row?.logo) return undefined
        if (size === 'maskable') {
            // Android crops maskable icons to a circle: keep the logo inside the central 80%
            const inner = await sharp(row.logo).resize(410, 410).toBuffer()
            return sharp({ create: { width: 512, height: 512, channels: 4, background: MASKABLE_BACKGROUND } })
                .composite([{ input: inner, gravity: 'center' }])
                .png()
                .toBuffer()
        }
        return LOGO_SIZES[size] === 512 ? row.logo : sharp(row.logo).resize(LOGO_SIZES[size]).png().toBuffer()
    }

    /** What the client reads at startup: identity, active functions and branding. Public, no session needed. */
    async publicConfig(): Promise<PublicConfig> {
        const row = await this.row()
        const features = FEATURES.filter(feature =>
            feature === 'google-login' ? isGoogleEnabled() : isFeatureEnabled(feature))
        return {
            name: this.venueName(row),
            slug: config.client.slug || null,
            features,
            logo: row.has_logo ? this.logoUrl(row, '512') : null,
            colors: { primary: row.primary_color, secondary: row.secondary_color },
            sentry: config.sentry.clientDsn
                ? { dsn: config.sentry.clientDsn, environment: config.app.environment, release: config.app.version }
                : null,
        }
    }

    /** Web app manifest with the venue name and logo, so the installed app looks like the venue's. */
    async manifest() {
        const row = await this.row()
        const name = this.venueName(row)
        const icon = (size: LogoSize, sizes: string, purpose: string) => ({
            src: row.has_logo ? this.logoUrl(row, size) : `/icon-${size === 'maskable' ? 'maskable-512' : size}.png`,
            sizes, type: 'image/png', purpose,
        })
        return {
            name: name || 'Chi Comanda',
            short_name: name || 'Chi Comanda',
            description: 'Ordini, bar e cassa per i tuoi eventi',
            lang: 'it',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            background_color: '#EFE5D2',
            theme_color: '#F8F1E3',
            icons: [icon('192', '192x192', 'any'), icon('512', '512x512', 'any'), icon('maskable', '512x512', 'maskable')],
        }
    }
}

export default new SettingsService()
