import type { ThemeDefinition } from 'vuetify'

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
        success: '#3F7A5E',
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
        success: '#7DBF9E',
        'on-success': '#0E2419',
        warning: '#E2C15A',
        'on-warning': '#2A2000',
    },
    variables: {
        'border-color': '#EFE5D2',
        'border-opacity': 0.14,
    },
}
