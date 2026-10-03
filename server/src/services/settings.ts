import sharp from 'sharp'
import config, { isFeatureEnabled } from '../config'
import { FEATURES } from '../features'
import { isGoogleEnabled } from '../auth/passport'
import { BadRequestError } from '../http/errors'
import type { PublicConfig, Settings } from '../../../models/src'
import venueService, { VenueBrandingRow } from './venue'
import { VenueContext } from '../venue/context'


export const LOGO_SIZES = { '192': 192, '512': 512, 'maskable': 512 } as const
export type LogoSize = keyof typeof LOGO_SIZES

/** Background of the maskable icon, around the logo: the cream of the default light theme. */
const MASKABLE_BACKGROUND = '#EFE5D2'
const COLOR = /^#[0-9a-fA-F]{6}$/

const NO_BRANDING: VenueBrandingRow = { id: 0, name: null, primary_color: null, secondary_color: null, has_logo: 0, version: 0 }

function toColor(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === '') return null
    if (typeof value !== 'string' || !COLOR.test(value)) {
        throw new BadRequestError(`Colore non valido: ${field}`)
    }
    return value.toUpperCase()
}

/**
 * Branding of the venues: the admin edits the one they work in. Public endpoints (config, manifest, logo) show the
 * venue of the session, else the installation's only venue, else the platform's defaults.
 */
class SettingsService {
    private async ownRow(ctx: VenueContext): Promise<VenueBrandingRow> {
        return (await ctx.db.queryOne<VenueBrandingRow>(`
            SELECT id, name, primary_color, secondary_color, logo IS NOT NULL has_logo, UNIX_TIMESTAMP(updated_at) version
            FROM venues WHERE id = :venue`))!
    }

    /** The venue whose branding a (possibly anonymous) request sees; undefined = the platform's. */
    async brandingVenue(sessionVenueId: number | null | undefined): Promise<number | undefined> {
        return sessionVenueId || venueService.singleActiveVenue()
    }

    private async publicRow(sessionVenueId: number | null | undefined): Promise<VenueBrandingRow> {
        const venueId = await this.brandingVenue(sessionVenueId)
        return (venueId && await venueService.branding(venueId)) || NO_BRANDING
    }

    private venueName(row: VenueBrandingRow): string | null {
        return row.id ? row.name || config.client.name || null : null
    }

    /** Versioned and per venue, so browsers can cache it forever and still see a new logo or another venue's. */
    private logoUrl(row: VenueBrandingRow, size: LogoSize): string {
        return `/api/public/logo/${size}.png?venue=${row.id}&v=${row.version}`
    }

    async get(ctx: VenueContext): Promise<Settings> {
        const { name, primary_color, secondary_color, has_logo } = await this.ownRow(ctx)
        return { venue_name: name, primary_color, secondary_color, has_logo: !!has_logo }
    }

    async update(ctx: VenueContext, input: Partial<Settings>): Promise<Settings> {
        const name = typeof input.venue_name === 'string' ? input.venue_name.trim() : ''
        if (name.length > 100) {
            throw new BadRequestError('Nome del locale troppo lungo (massimo 100 caratteri)')
        }
        await ctx.db.execute(
            'UPDATE venues SET name = ?, primary_color = ?, secondary_color = ? WHERE id = :venue',
            [name || null, toColor(input.primary_color, 'primario'), toColor(input.secondary_color, 'secondario')])
        return this.get(ctx)
    }

    /** Stores the uploaded image as a 512x512 PNG (transparent margins). */
    async setLogo(ctx: VenueContext, file: Buffer): Promise<void> {
        let png: Buffer
        try {
            png = await sharp(file)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toBuffer()
        } catch {
            throw new BadRequestError('Immagine non valida')
        }
        await ctx.db.execute('UPDATE venues SET logo = ? WHERE id = :venue', [png])
    }

    async deleteLogo(ctx: VenueContext): Promise<void> {
        await ctx.db.execute('UPDATE venues SET logo = NULL WHERE id = :venue')
    }

    /**
     * The logo of the venue the request sees, as a PNG of the given size; undefined when there is none, or when the
     * URL names another venue (`requestedVenue`, the cache key of the URL).
     */
    async logo(sessionVenueId: number | null | undefined, size: LogoSize, requestedVenue?: number): Promise<Buffer | undefined> {
        const venueId = await this.brandingVenue(sessionVenueId)
        if (!venueId || (requestedVenue !== undefined && requestedVenue !== venueId)) return undefined
        const logo = await venueService.logo(venueId)
        if (!logo) return undefined
        if (size === 'maskable') {
            // Android crops maskable icons to a circle: keep the logo inside the central 80%
            const inner = await sharp(logo).resize(410, 410).toBuffer()
            return sharp({ create: { width: 512, height: 512, channels: 4, background: MASKABLE_BACKGROUND } })
                .composite([{ input: inner, gravity: 'center' }])
                .png()
                .toBuffer()
        }
        return LOGO_SIZES[size] === 512 ? logo : sharp(logo).resize(LOGO_SIZES[size]).png().toBuffer()
    }

    /** What the client reads at startup: identity, active functions and branding. Public, no session needed. */
    async publicConfig(sessionVenueId?: number | null): Promise<PublicConfig> {
        const row = await this.publicRow(sessionVenueId)
        // The venue's functions once it is known; Google login is the installation's (it comes before the venue)
        const venue = row.id ? await venueService.features(row.id) : undefined
        const features = FEATURES.filter(feature =>
            feature === 'google-login' ? isGoogleEnabled() : (venue ? venue.has(feature) : isFeatureEnabled(feature)))
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
    async manifest(sessionVenueId?: number | null) {
        const row = await this.publicRow(sessionVenueId)
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
