import type { ThemeDefinition } from 'vuetify'
import { darken, onColor } from '@/composables/useConfig'

/**
 * Palette Art Déco, la stessa delle illustrazioni del logo: carta crema e inchiostro,
 * blu notte come colore principale, verde acqua, ocra e corallo per stati e accenti.
 * Il tema scuro è in blu notte, come il sito del matrimonio, con il blu polvere come colore principale.
 */
export const light: ThemeDefinition = {
    dark: false,
    colors: {
        background: '#EFE5D2',
        surface: '#F8F1E3',
        'surface-bright': '#FFFBF3',
        'surface-light': '#E6D7BB',
        'surface-variant': '#2A2522',
        'on-surface-variant': '#EFE5D2',
        'on-background': '#2A2522',
        'on-surface': '#2A2522',
        primary: '#22427A',
        'primary-darken-1': '#1A3361',
        secondary: '#2F7472',
        'secondary-darken-1': '#245B59',
        error: '#B04A33',
        info: '#2F7472',
        // Deep jade: next to the ochre and the night blue, not a generic "success" green
        success: '#2E6A5A',
        warning: '#A86F14',
    },
    variables: {
        'border-color': '#2A2522',
        'border-opacity': 0.14,
    },
}

export const dark: ThemeDefinition = {
    dark: true,
    colors: {
        background: '#0E1A33',
        surface: '#142447',
        'surface-bright': '#1D3260',
        'surface-light': '#182C55',
        'surface-variant': '#EFE5D2',
        'on-surface-variant': '#0E1A33',
        'on-background': '#EFE5D2',
        'on-surface': '#EFE5D2',
        primary: '#8AA8DA',
        'on-primary': '#0E1A33',
        'primary-darken-1': '#6F8FC4',
        secondary: '#7FC2BF',
        'on-secondary': '#0D2423',
        'secondary-darken-1': '#62A8A5',
        error: '#E8907E',
        'on-error': '#2A1310',
        info: '#7FC2BF',
        'on-info': '#0D2423',
        success: '#5E9C8A',
        'on-success': '#0B1F1A',
        warning: '#E2C15A',
        'on-warning': '#2A2000',
    },
    variables: {
        'border-color': '#EFE5D2',
        'border-opacity': 0.14,
    },
}

const BRAND_COLORS = ['primary', 'secondary'] as const

/**
 * Applies the venue's colours (null = Art Déco default) to both themes, in place.
 * Used at startup on the definitions and, after the admin saves, on Vuetify's live themes.
 */
export function applyBrandColors(
    themes: Record<string, ThemeDefinition>,
    colors: { primary: string | null, secondary: string | null },
) {
    for (const [name, base] of [['light', light], ['dark', dark]] as const) {
        const target = themes[name].colors!
        for (const key of BRAND_COLORS) {
            const chosen = colors[key]
            const baseColor = base.colors![key]!
            target[key] = chosen || baseColor
            target[`${key}-darken-1`] = chosen ? darken(chosen) : base.colors![`${key}-darken-1`]!
            target[`on-${key}`] = chosen ? onColor(chosen) : base.colors![`on-${key}`] ?? onColor(baseColor)
        }
    }
}
