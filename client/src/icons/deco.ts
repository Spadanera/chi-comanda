/**
 * Art Déco icon set of Chi Comanda, in the style of the logo: thin ink line (the current text
 * colour, so it follows the theme), stepped bases, fans and sunbursts, double rules and a small
 * diamond as accent. 24×24 grid, stroke drawn by the `.deco-icon` CSS (1.6, round caps).
 *
 * Keys are the mdi names already used in the app (and stored in the database for categories):
 * the icon set in plugins/icons.ts draws these and falls back to the mdi font for the others.
 */

/** Small filled diamond, the recurring accent. */
const diamond = (x: number, y: number, r = 1) =>
    `<path d="M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z" fill="currentColor" stroke="none"/>`

/** Fan of short rays around (x, y), from angle `a0` to `a1` in degrees (0 = right, -90 = up). */
function rays(x: number, y: number, r0: number, r1: number, a0: number, a1: number, count: number) {
    let d = ''
    for (let i = 0; i < count; i++) {
        const a = (a0 + (a1 - a0) * (count === 1 ? 0.5 : i / (count - 1))) * Math.PI / 180
        const f = (n: number) => +n.toFixed(2)
        d += `M${f(x + r0 * Math.cos(a))} ${f(y + r0 * Math.sin(a))}L${f(x + r1 * Math.cos(a))} ${f(y + r1 * Math.sin(a))}`
    }
    return `<path d="${d}"/>`
}

const p = (d: string) => `<path d="${d}"/>`
const circle = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`
const dot = (cx: number, cy: number, r = 1) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`

// ── Shared shapes ───────────────────────────────────────────────────────────

const bust = (x = 12, s = 1) =>
    circle(x, 8, 3.4 * s) + p(`M${x - 6.5 * s} 20.5c0-3.9 2.9-6.5 ${6.5 * s}-6.5s${6.5 * s} 2.6 ${6.5 * s} 6.5`) + p(`M${x - 1.6 * s} 14.2L${x} 16.6L${x + 1.6 * s} 14.2`)
const roundFrame = circle(12, 12, 9)
const squareFrame = p('M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z')
const check = (s = 1, x = 12, y = 12) => p(`M${x - 4.5 * s} ${y + 0.2 * s}l${3 * s} ${3 * s}l${6 * s} -${6.4 * s}`)
const cross = (r = 3.6) => p(`M${12 - r} ${12 - r}L${12 + r} ${12 + r}M${12 + r} ${12 - r}L${12 - r} ${12 + r}`)
/** Stepped base, the Déco signature of bottles and glasses. */
const steppedBase = (x: number, y: number, w: number) => p(`M${x - w} ${y}h${2 * w}M${x - w + 1.5} ${y - 1.6}h${2 * w - 3}`)
const coupe = p('M5.5 5.5h13l-6.5 7z') + p('M12 12.5v6') + steppedBase(12, 20, 4) + p('M8.5 5.5l3.5 3.8')

export const DECO_ICONS: Record<string, string> = {
    // ── People and roles ────────────────────────────────────────────────────
    'mdi-account': bust(),
    'mdi-account-group': bust(9, 0.85) + p('M15.2 4.9a3 3 0 1 1 0 5.9') + p('M17.4 13.9c2.4.6 4.1 2.8 4.1 5.9'),
    'mdi-account-multiple': bust(9, 0.85) + p('M15.2 4.9a3 3 0 1 1 0 5.9') + p('M17.4 13.9c2.4.6 4.1 2.8 4.1 5.9'),
    'mdi-account-voice': bust(9, 0.85) + rays(15, 9.5, 3.5, 6.5, -40, 40, 3),
    /** Waiter: bust with bow tie and tray held up */
    'mdi-walk': circle(10, 7.5, 2.8) + p('M4.5 20.5c0-3.6 2.5-6.2 5.5-6.2s5.5 2.6 5.5 6.2') + p('M8.7 14.6l1.3 1.2 1.3-1.2') + p('M14.6 15.2L17 9.5') + p('M14 8.6h6.5') + diamond(17.2, 6.4, 0.9),
    /** Admin: Déco crown */
    'mdi-shield-crown': p('M4 18.5h16') + p('M5 16.5L4 7.5l4.5 4L12 4.5l3.5 7 4.5-4-1 9z') + diamond(12, 13, 1.1),
    /** Audit: ledger with magnifying glass */
    'mdi-police-badge': p('M5 4h9.5v16H5z') + p('M7.5 8h4.5M7.5 11h3') + circle(16, 15, 3.2) + p('M18.4 17.4L21 20'),

    // ── Navigation and actions ──────────────────────────────────────────────
    'mdi-menu': p('M4 7h16M7 12h10M4 17h16') + diamond(4, 12, 0.9) + diamond(20, 12, 0.9),
    /** Food menu: card with a fan header */
    'mdi-book-open-variant': p('M6 3.5h12v17H6z') + rays(12, 10, 2, 4, -160, -20, 5) + p('M9 13.5h6M9 16.5h6'),
    'mdi-arrow-left': p('M20 12H4.5M10 6.5L4.5 12l5.5 5.5'),
    'mdi-arrow-right': p('M4 12h15.5M14 6.5l5.5 5.5-5.5 5.5'),
    'mdi-arrow-up': p('M12 20V4.5M6.5 10L12 4.5l5.5 5.5'),
    'mdi-arrow-down': p('M12 4v15.5M6.5 14l5.5 5.5 5.5-5.5'),
    'mdi-arrow-up-thin': p('M12 19V6M8 10l4-4 4 4') + p('M9 19h6'),
    'mdi-chevron-down': p('M6.5 9.5L12 15l5.5-5.5'),
    'mdi-chevron-up': p('M6.5 14.5L12 9l5.5 5.5'),
    'mdi-chevron-left': p('M14.5 6.5L9 12l5.5 5.5'),
    'mdi-chevron-right': p('M9.5 6.5L15 12l-5.5 5.5'),
    'mdi-menu-down': '<path d="M7 10h10l-5 5.5z" fill="currentColor"/>',
    'mdi-menu-right': '<path d="M10 7v10l5.5-5z" fill="currentColor"/>',
    'mdi-page-first': p('M6 6v12M17 6.5L11.5 12l5.5 5.5'),
    'mdi-page-last': p('M18 6v12M7 6.5l5.5 5.5L7 17.5'),
    'mdi-unfold-more-horizontal': p('M8 9l4-4 4 4M8 15l4 4 4-4'),
    'mdi-logout': p('M13.5 4H6v16h7.5') + p('M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5'),
    'mdi-plus': p('M12 5v14M5 12h14'),
    'mdi-minus': p('M5 12h14'),
    'mdi-pencil': p('M4.5 19.5l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L9 18.5z') + p('M13.8 6.7l3.5 3.5'),
    'mdi-delete': p('M4.5 6.5h15M9.5 6.5V4h5v2.5') + p('M6.5 6.5l1 13.5h9l1-13.5') + p('M10 10v6.5M14 10v6.5'),
    'mdi-content-copy': p('M8.5 8.5h11v12h-11z') + p('M15.5 8.5V4h-11v12h4'),
    'mdi-content-save': p('M4.5 4.5h12l3 3v12h-15z') + p('M8 4.5v4.5h7V4.5') + circle(12, 14.5, 2.4),
    'mdi-undo': p('M9 5L4.5 9.5 9 14') + p('M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3'),
    'mdi-cached': p('M19 12a7 7 0 0 1-12 4.9M5 12a7 7 0 0 1 12-4.9') + p('M17 3.5v3.6h-3.6M7 20.5v-3.6h3.6'),
    'mdi-paperclip': p('M15.5 7.5l-6.8 6.8a2.1 2.1 0 0 0 3 3l7.2-7.2a3.8 3.8 0 0 0-5.4-5.4l-7.4 7.4a5.5 5.5 0 0 0 7.8 7.8l6-6'),
    'mdi-send': p('M4 4.5l16.5 7.5L4 19.5l2.5-7.5z') + p('M6.5 12h6'),
    /** Destinations (bar, kitchen): service bell on the counter */
    'mdi-send-check': p('M3.5 20h17M5 20v-3.5h14V20') + p('M7 16.5a5 5 0 0 1 10 0') + p('M12 11.5V10') + diamond(12, 8.6, 1.1) + rays(12, 9, 4.5, 6.5, -150, -120, 2) + rays(12, 9, 4.5, 6.5, -60, -30, 2),
    'mdi-magnify-plus-outline': circle(10.5, 10.5, 6) + p('M15 15l5 5M8 10.5h5M10.5 8v5'),
    'mdi-magnify-minus-outline': circle(10.5, 10.5, 6) + p('M15 15l5 5M8 10.5h5'),
    'mdi-eye': p('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z') + circle(12, 12, 3) + dot(12, 12, 1),
    'mdi-eye-off': p('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z') + circle(12, 12, 3) + p('M4 20L20 4'),
    'mdi-list-box': squareFrame + p('M10.5 9h5.5M10.5 12h5.5M10.5 15h5.5') + diamond(8, 9, 0.8) + diamond(8, 12, 0.8) + diamond(8, 15, 0.8),
    'mdi-qrcode': p('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z') + dot(7, 7) + dot(17, 7) + dot(7, 17) + p('M14 14h2.5v2.5M20 14v2.5M14 20h2.5M18.5 18.5H20V20'),
    'mdi-lightning-bolt': p('M13.5 3L6 13.5h5.5L10 21l8-11h-5.5z'),
    'mdi-timer-sand': p('M6.5 3.5h11M6.5 20.5h11') + p('M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5M16.5 3.5c0 4.5-4.5 5.5-4.5 8.5s4.5 4 4.5 8.5') + p('M9.5 18.5h5'),
    'mdi-calendar': p('M4 6h16v14H4z') + p('M4 10h16M8 3.5V7M16 3.5V7') + diamond(12, 15, 1.2),

    // ── States and feedback ─────────────────────────────────────────────────
    'mdi-check': check(1.15),
    'mdi-check-all': p('M2.5 12.5l3 3 6-6.5') + p('M9.5 15.5l1 1 10-10.5'),
    'mdi-check-circle': roundFrame + check(0.85),
    'mdi-close': cross(5.5),
    'mdi-window-close': cross(5.5),
    'mdi-close-circle': roundFrame + cross(3.4),
    'mdi-close-box': squareFrame + cross(3.4),
    'mdi-alert': p('M12 3.5l9.5 16.5h-19z') + p('M12 9.5v5') + dot(12, 17.3, 1.1),
    'mdi-alert-circle': roundFrame + p('M12 7.5v5.5') + dot(12, 16.3, 1.1),
    'mdi-information': roundFrame + p('M12 11v5.5') + dot(12, 7.8, 1.1),
    'mdi-help-circle-outline': roundFrame + p('M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6') + dot(12, 16.8, 1.1),
    'mdi-star-circle': roundFrame + p('M12 6.8l1.6 3.4 3.7.4-2.8 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.5 3.7-.4z'),
    'mdi-checkbox-marked': '<path d="M4.5 7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 7v10a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17z" fill="currentColor"/><path d="M8 12.2l2.7 2.7 5.3-5.6" stroke="rgb(var(--v-theme-surface))" stroke-width="2"/>',
    'mdi-checkbox-blank-outline': p('M4.5 7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 7v10a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17z'),
    'mdi-minus-box': '<path d="M4.5 7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 7v10a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17z" fill="currentColor"/><path d="M8 12h8" stroke="rgb(var(--v-theme-surface))" stroke-width="2"/>',
    'mdi-radiobox-marked': circle(12, 12, 8) + dot(12, 12, 4),
    'mdi-radiobox-blank': circle(12, 12, 8),
    'mdi-circle': dot(12, 12, 6),

    // ── Communication ──────────────────────────────────────────────────────
    'mdi-bell-ring': p('M6 17V11a6 6 0 0 1 12 0v6l1.5 1.5h-15z') + p('M10 20.5h4') + diamond(12, 3.6, 1) + rays(12, 11, 9.5, 11.5, -165, -135, 2) + rays(12, 11, 9.5, 11.5, -45, -15, 2),
    'mdi-message-alert': p('M4 5h16v11H9l-5 4z') + p('M12 7.8v4') + dot(12, 13.8, 1),
    'mdi-message-bulleted': p('M4 5h16v11H9l-5 4z') + diamond(8, 9, 0.8) + diamond(8, 12.3, 0.8) + p('M10.5 9h6M10.5 12.3h4.5'),
    'mdi-message-fast': p('M8 5h13v11h-9l-4 3.5z') + p('M2 8h4M3 11h3M2 14h4'),
    'mdi-theme-light-dark': roundFrame + '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
    'mdi-weather-sunny': circle(12, 12, 4) + rays(12, 12, 6.5, 9.5, 0, 315, 8),
    'mdi-weather-night': p('M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z') + diamond(16.5, 6, 1) + diamond(19.5, 9.5, 0.7),

    // ── Money and checkout ─────────────────────────────────────────────────
    'mdi-cash': p('M2.5 7h19v10h-19z') + circle(12, 12, 2.6) + p('M2.5 9.5A2.5 2.5 0 0 0 5 7M19 7a2.5 2.5 0 0 0 2.5 2.5M2.5 14.5A2.5 2.5 0 0 1 5 17M19 17a2.5 2.5 0 0 1 2.5-2.5'),
    'mdi-cash-register': p('M3.5 20.5h17M5 20.5V13h14v7.5') + p('M7 13V8h10v5') + p('M9 5.5h6V8H9z') + p('M8 16h2M11 16h2M14 16h2'),
    'mdi-currency-eur': p('M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5') + p('M5 10h8M5 14h7'),
    'mdi-credit-card-outline': p('M3 6h18v12H3z') + p('M3 9.5h18') + p('M6 14.5h4') + diamond(17, 14.5, 1),
    'mdi-credit-card-wireless-outline': p('M3 8h14v11H3z') + p('M3 11h14M6 15.5h3') + rays(18, 6.5, 1.5, 4.5, -75, -15, 1) + p('M18 3.5a4 4 0 0 1 3 3M18 1a6.5 6.5 0 0 1 5 5'),
    'mdi-cellphone-nfc': p('M7.5 3h9v18h-9z') + p('M10.5 18h3') + p('M10 9a3 3 0 0 1 0 4M12.5 7.5a5.5 5.5 0 0 1 0 7'),
    'mdi-receipt-text-send': p('M5 3.5h11v17l-2-1.5-1.8 1.5-1.7-1.5-1.8 1.5L5 19z') + p('M7.5 8h6M7.5 11h6M7.5 14h4') + p('M18 12h4M20.5 10l1.5 2-1.5 2'),
    /** Discount: price tag with percent */
    'mdi-cart-percent': p('M3.5 12.5L11.5 4.5H19.5V12.5L11.5 20.5z') + circle(16, 8, 1.2) + p('M8.5 15.5l5-5') + dot(9, 11.2, 0.9) + dot(13, 15, 0.9),

    // ── Tables ─────────────────────────────────────────────────────────────
    'mdi-table-furniture': p('M3 8h18M5 8l-1.5 12M19 8l1.5 12M7 8v5h10V8') + diamond(12, 5, 1),
    'mdi-table-chair': p('M2.5 9.5h11.5M8.25 9.5V19') + steppedBase(8.25, 20.5, 3.5) + p('M20.5 5v15.5M15.5 14h5M15.5 14v6.5') + diamond(8.25, 6.5, 1),

    // ── Brands are not redrawn: mdi-google stays the original ────────────────

    // ── Drinks (categories) ────────────────────────────────────────────────
    /** Draft beer: mug with foam */
    'mdi-glass-mug-variant': p('M6 8h9.5v12H6z') + p('M15.5 10.5h2a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2h-2') + p('M5.5 8c0-1.7 1.3-3 3-3 .6-1 1.5-1.5 2.5-1.5s2 .6 2.5 1.5c1.7 0 3 1.3 3 3') + p('M9 11v6M12.5 11v6'),
    'mdi-beer': p('M6 8h9.5v12H6z') + p('M15.5 10.5h2a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2h-2') + p('M5.5 8c0-1.7 1.3-3 3-3 .6-1 1.5-1.5 2.5-1.5s2 .6 2.5 1.5c1.7 0 3 1.3 3 3') + p('M9 11v6M12.5 11v6'),
    'mdi-glass-pint-outline': p('M6 4h12l-1.6 16.5H7.6z') + p('M6.6 9.5h10.8') + diamond(12, 14.5, 1),
    'mdi-glass-stange': p('M8 3.5h8l-.8 17H8.8z') + p('M8.2 8h7.6'),
    /** Bottled beer: long-neck bottle with label */
    'mdi-bottle-wine': p('M10 3h4v4.5c2 1 3 2.6 3 4.5v8.5H7V12c0-1.9 1-3.5 3-4.5z') + p('M7 13h10M7 17h10') + diamond(12, 15, 0.9),
    'mdi-bottle-tonic': p('M10.5 3h3v3.5c1.8.8 2.5 2 2.5 3.5v10.5H8V10c0-1.5.7-2.7 2.5-3.5z') + p('M8 12.5h8') + rays(12, 16.5, 0.8, 2.6, 0, 300, 6),
    /** Soft drink: soda bottle with Déco ribs */
    'mdi-bottle-soda': p('M10 3h4v2.5c1.5.8 2.5 2.4 2.5 4.2V20.5h-9V9.7c0-1.8 1-3.4 2.5-4.2z') + p('M7.5 11h9M7.5 15.5h9') + p('M10 11v4.5M14 11v4.5'),
    'mdi-glass-cocktail': coupe + dot(9, 7, 1),
    'mdi-glass-wine': p('M7.5 3.5h9c0 4.5-1.5 7.5-4.5 7.5S7.5 8 7.5 3.5z') + p('M7.8 6.5h8.4') + p('M12 11v7.5') + steppedBase(12, 20.5, 4),
    'mdi-glass-flute': p('M9.5 3.5h5l-.6 7.5a1.9 1.9 0 0 1-3.8 0z') + p('M12 13v5.5') + steppedBase(12, 20.5, 3.5) + dot(11.5, 6.5, 0.6) + dot(12.7, 8.5, 0.6),
    'mdi-glass-tulip': p('M8 3.5h8c.3 2.4-.4 4-1.6 5.2.9.8 1.6 1.9 1.6 3.3 0 2.2-1.8 3.5-4 3.5s-4-1.3-4-3.5c0-1.4.7-2.5 1.6-3.3C8.4 7.5 7.7 5.9 8 3.5z') + p('M12 15.5v3') + steppedBase(12, 20.5, 3.5),
    /** Spirits: shot glass with Déco ribs */
    'mdi-cup': p('M7 6h10l-1.5 14h-7z') + p('M7.4 10h9.2') + p('M10 10v10M14 10v10'),
    'mdi-shaker-outline': p('M8 9h8l-1 11.5H9z') + p('M8.5 9V7h7v2') + p('M10.5 7V4.5h3V7') + diamond(12, 14.5, 1),
    'mdi-cup-water': p('M6.5 4h11l-1.5 16.5H8z') + p('M7.3 11c1.6-.8 3.1-.8 4.7 0s3.1.8 4.7 0'),
    'mdi-coffee': p('M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z') + p('M16 10.5h1.5a2.3 2.3 0 0 1 0 4.6H16') + p('M3.5 21h14') + p('M8.5 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3'),
    'mdi-tea': p('M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z') + p('M16 9.5h1.5a2.3 2.3 0 0 1 0 4.6H16') + p('M3.5 21h14') + p('M10.5 8V5l2.5-1.5') + p('M9.5 10.5h2.2v2.2H9.5z'),

    // ── Food (categories) ──────────────────────────────────────────────────
    'mdi-hamburger': p('M4 10a8 5.5 0 0 1 16 0z') + p('M3.5 13.5h17') + p('M4.5 16.5h15a0 0 0 0 1 0 0c0 2-1.5 3.5-3.5 3.5H8c-2 0-3.5-1.5-3.5-3.5') + dot(9, 7.5, 0.6) + dot(12, 6.3, 0.6) + dot(15, 7.5, 0.6),
    /** Piadina: folded flatbread with grill lines */
    'mdi-taco': p('M3 17a9 9 0 0 1 18 0z') + p('M7 17a5 5 0 0 1 10 0') + rays(12, 17, 6, 8.2, -150, -30, 5),
    'mdi-food-hot-dog': p('M5 15.5c-1.4-1.4-1.4-3.6 0-5L10.5 5c1.4-1.4 3.6-1.4 5 0') + p('M8.5 19c1.4 1.4 3.6 1.4 5 0L19 13.5c1.4-1.4 1.4-3.6 0-5') + p('M6.5 17.5L17.5 6.5') + p('M9 13l1 1M12 10l1 1M15 7l1 1'),
    /** Panino */
    'mdi-baguette': p('M4 13c0-3 3.5-5.5 8-5.5s8 2.5 8 5.5z') + p('M3.5 15.5h17') + p('M4 17.5h16c0 1.5-1 2.5-2.5 2.5h-11C5 20 4 19 4 17.5z') + p('M9 9l1.5 2M13 8.5l1.5 2'),
    'mdi-french-fries': p('M6 11l1.5 9.5h9L18 11z') + p('M8 11V4.5M10.5 11V3.5M13.5 11V4M16 11V5') + diamond(12, 15.5, 1.2),
    'mdi-pizza': p('M12 21L3.5 6.5a17 17 0 0 1 17 0z') + p('M5.3 9.5a14 14 0 0 1 13.4 0') + dot(10, 12, 1) + dot(14, 12.5, 1) + dot(12, 16, 1),
    'mdi-food-croissant': p('M3 15.5c1-5 5-8.5 9-8.5s8 3.5 9 8.5c-2 1-4 1-5.5 0-1 1.5-2.2 2-3.5 2s-2.5-.5-3.5-2c-1.5 1-3.5 1-5.5 0z') + p('M8.5 8.5l1 7M15.5 8.5l-1 7M12 7v8.5'),
    'mdi-food-drumstick': p('M14.5 3.5a6 6 0 0 1 3.5 10.5c-1.3 1.3-3.4 1.8-5.3 1.2l-2.9 2.9a2 2 0 1 1-2.2 2.2 2 2 0 1 1-2.2-2.2l2.9-2.9c-.6-1.9-.1-4 1.2-5.3a6 6 0 0 1 5-6.4z'),
    'mdi-cheese': p('M3 9.5L15 4l6 5.5v10H3z') + p('M3 9.5h18') + circle(8, 14, 1.4) + circle(15, 15.5, 1.8),
    'mdi-noodles': p('M3.5 11h17a8.5 8.5 0 0 1-17 0z') + p('M8 11c0-3 1-6 3-7.5M11 11c0-2.5.8-5 2.5-6.5M14 11c0-2 .6-4 2-5.2') + p('M8 20.5h8'),
    'mdi-cake-variant': p('M4 12h16v8.5H4z') + p('M4 15.5c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0') + p('M12 12V8') + p('M12 3.5c1 1.2 1 2.5 0 3.3-1-.8-1-2.1 0-3.3z'),
    'mdi-ice-cream': p('M7.5 10.5L12 21l4.5-10.5') + p('M6.5 10.5a5.5 5.5 0 0 1 11 0z') + p('M9 13.5l4.5 2M10 16.5l3-1.5'),
    'mdi-candy': circle(12, 12, 4) + p('M8.5 10L4 6.5V11zM15.5 14l4.5 3.5V13z') + diamond(12, 12, 1.2),
}

/** Category icons the admin can choose from (key, label), all drawn in the Déco set. */
export const CATEGORY_ICONS: [string, string][] = [
    ['mdi-glass-mug-variant', 'Birra alla spina'],
    ['mdi-glass-pint-outline', 'Pinta'],
    ['mdi-glass-stange', 'Bicchiere alto'],
    ['mdi-bottle-wine', 'Birra in bottiglia'],
    ['mdi-glass-cocktail', 'Cocktail'],
    ['mdi-shaker-outline', 'Shaker'],
    ['mdi-glass-wine', 'Vino'],
    ['mdi-glass-flute', 'Bollicine'],
    ['mdi-glass-tulip', 'Calice a tulipano'],
    ['mdi-cup', 'Shot e amari'],
    ['mdi-bottle-tonic', 'Bibita'],
    ['mdi-bottle-soda', 'Analcolico'],
    ['mdi-cup-water', 'Acqua'],
    ['mdi-coffee', 'Caffè'],
    ['mdi-tea', 'Tè e tisane'],
    ['mdi-taco', 'Piadina'],
    ['mdi-baguette', 'Panino'],
    ['mdi-hamburger', 'Hamburger'],
    ['mdi-food-hot-dog', 'Hot dog'],
    ['mdi-french-fries', 'Fritti e special'],
    ['mdi-pizza', 'Pizza'],
    ['mdi-food-croissant', 'Croissant'],
    ['mdi-food-drumstick', 'Carne'],
    ['mdi-cheese', 'Formaggi e taglieri'],
    ['mdi-noodles', 'Primi'],
    ['mdi-cake-variant', 'Dolci'],
    ['mdi-ice-cream', 'Gelato'],
    ['mdi-candy', 'Snack'],
    ['mdi-star-circle', 'Speciale'],
    ['mdi-help-circle-outline', 'Altro'],
]
