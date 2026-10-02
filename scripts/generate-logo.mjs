// Genera il logo di Chi Comanda (il maître, stile Art Déco) e tutte le sue varianti:
//   client/src/assets/logo/maitre-{light,dark}.svg   app (barra in alto, login)
//   client/public/favicon.svg, favicon.ico           scheda del browser (solo la coppa: il maître sotto i 40 px non si legge)
//   client/public/apple-touch-icon.png               icona in home su iPhone
//   client/public/icon-{192,512}.png, icon-maskable-512.png, manifest.webmanifest
//                                                    icona in home su Android ("Aggiungi a schermata Home" / installa app)
//   client/public/logo-email.png                     email di invito e reset (i client email non mostrano gli SVG)
//
// Uso: npm install in server/ (serve sharp), poi `node scripts/generate-logo.mjs` dalla root.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sharp = createRequire(join(root, 'server', 'package.json'))('sharp')

const K = { cream: '#F5ECDA', ink: '#2A2522', blue: '#22427A', teal: '#3E8C8A', ochre: '#D29A3C', coral: '#CF6F55', skin: '#EDD7B9', dark: '#26211F' }
const VARIANTS = {
    light: { disc: K.cream, ink: K.ink },
    dark: { disc: '#1E2127', ink: '#EFE5D2' },
}

const n = v => +v.toFixed(1)
const rad = a => a * Math.PI / 180
const pt = (cx, cy, r, a) => [n(cx + r * Math.cos(rad(a))), n(cy + r * Math.sin(rad(a)))]

function rays(cx, cy, r0, r1, from, to, count, color, width) {
    let s = ''
    for (let i = 0; i < count; i++) {
        const a = from + (to - from) * (i / (count - 1))
        const [x0, y0] = pt(cx, cy, r0, a), [x1, y1] = pt(cx, cy, r1, a)
        s += `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`
    }
    return s
}

/** Righe verticali da abito anni '20. */
function stripes(id, bands, base) {
    let x = 0, rects = ''
    for (const [w, c] of bands) { rects += `<rect x="${x}" width="${w}" height="10" fill="${c}"/>`; x += w }
    return `<pattern id="${id}" width="${x}" height="10" patternUnits="userSpaceOnUse"><rect width="${x}" height="10" fill="${base}"/>${rects}</pattern>`
}

const frame = v =>
    `<circle cx="100" cy="100" r="94" fill="${v.disc}" stroke="${v.ink}" stroke-width="3.2"/>` +
    `<circle cx="100" cy="100" r="86" fill="none" stroke="${v.ink}" stroke-width="1.1"/>`

/** Il maître: cameriere da figurino con il vassoio alzato, sotto un arco con raggiera. */
function maitre(v) {
    let s = '<defs>' + stripes('jacket', [[3, K.cream], [3.4, K.blue], [1, K.cream], [.9, K.ochre]], K.cream) +
        '<clipPath id="disc"><circle cx="100" cy="100" r="85"/></clipPath>' +
        '<clipPath id="arch"><path d="M44 196V100A56 56 0 0 1 156 100V196Z"/></clipPath></defs>'
    s += frame(v)
    s += `<g clip-path="url(#arch)">${rays(100, 192, 30, 160, -158, -22, 17, K.ochre, 1.7)}</g>`
    s += '<g clip-path="url(#disc)">'
    s += `<path d="M44 196V100A56 56 0 0 1 156 100V196" fill="none" stroke="${K.teal}" stroke-width="2.6"/>`
    s += `<path d="M50 196V101A50 50 0 0 1 150 101V196" fill="none" stroke="${v.ink}" stroke-width="1"/>`
    s += '</g>'
    // Pantaloni e scarpe
    s += `<path d="M88.5 148L86.5 180H93L96 152L99 180H105.5L103.5 148Z" fill="${K.dark}" stroke="${v.ink}" stroke-width="1.2" stroke-linejoin="round"/>`
    s += `<path d="M83 181.5H93.5M98.5 181.5H109" stroke="${v.ink}" stroke-width="3.6" stroke-linecap="round"/>`
    // Frac a righe: spalle larghe, punto vita stretto, code svasate
    s += `<path d="M82.5 74H108.5Q105 98 103.5 110L111 152H81L88.5 110Q86.5 98 82.5 74Z" fill="url(#jacket)" stroke="${v.ink}" stroke-width="2.2" stroke-linejoin="round"/>`
    s += `<path d="M88.5 110H103.5" stroke="${v.ink}" stroke-width="1.2"/>`
    s += `<path d="M90 74L95.5 104L101 74Z" fill="${K.cream}" stroke="${v.ink}" stroke-width="1.4" stroke-linejoin="round"/>`
    s += `<path d="M90.5 74L95.5 77.6L90.5 81.2ZM100.5 74L95.5 77.6L100.5 81.2Z" fill="${K.coral}" stroke="${v.ink}" stroke-width=".6" stroke-linejoin="round"/>`
    // Braccio lungo il fianco con il tovagliolo appeso
    s += `<path d="M84 78Q80 98 82 116" fill="none" stroke="${v.ink}" stroke-width="3.4" stroke-linecap="round"/>`
    s += `<path d="M78.5 113H86L85 131L81 127L78 131Z" fill="${K.cream}" stroke="${v.ink}" stroke-width="1.3" stroke-linejoin="round"/>`
    // Testa con i capelli impomatati
    s += `<path d="M95.5 65V74" stroke="${v.ink}" stroke-width="2.4"/>`
    s += `<ellipse cx="95.5" cy="56" rx="8" ry="10" fill="${K.skin}" stroke="${v.ink}" stroke-width="1.7"/>`
    s += `<path d="M87.4 55Q87.6 45 96 45Q104.5 45.5 103.6 54Q97 48.5 87.4 55Z" fill="${K.dark}"/>`
    // Braccio alzato, vassoio e coppa con le bollicine
    s += `<path d="M107 79Q121 68 125 48" fill="none" stroke="${v.ink}" stroke-width="3.4" stroke-linecap="round"/>`
    s += `<ellipse cx="126" cy="42" rx="19" ry="3.8" fill="${K.cream}" stroke="${v.ink}" stroke-width="1.7"/>`
    s += `<path d="M125 38V30" stroke="${v.ink}" stroke-width="1.6"/>`
    s += `<path d="M121.5 38.4H128.5" stroke="${v.ink}" stroke-width="1.6" stroke-linecap="round"/>`
    s += `<path d="M117 23Q125 34 133 23Z" fill="${K.ochre}" stroke="${v.ink}" stroke-width="1.5" stroke-linejoin="round"/>`
    s += `<circle cx="113" cy="24" r="1.8" fill="${K.coral}"/><circle cx="108.5" cy="18.5" r="1.4" fill="${K.teal}"/>`
    return s
}

/** La sola coppa con la raggiera: la versione del logo per le icone piccole. */
function coupe(v) {
    let s = '<defs><clipPath id="disc"><circle cx="100" cy="100" r="85"/></clipPath></defs>' + frame(v)
    s += '<g clip-path="url(#disc)">' + rays(100, 122, 40, 92, -172, -8, 13, K.ochre, 4)
    ;[K.blue, K.ochre, K.coral].forEach((c, i) => { s += `<path d="M0 ${158 + i * 7}H200" stroke="${c}" stroke-width="3.6"/>` })
    s += '</g>'
    s += `<path d="M100 114V152" stroke="${v.ink}" stroke-width="5" stroke-linecap="round"/>`
    s += `<path d="M76 156Q100 145 124 156Z" fill="${K.blue}" stroke="${v.ink}" stroke-width="3.4" stroke-linejoin="round"/>`
    s += `<path d="M54 88Q100 142 146 88Z" fill="${K.ochre}" stroke="${v.ink}" stroke-width="4" stroke-linejoin="round"/>`
    return s
}

const svg = (body, label) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${label}">${body}</svg>\n`

/** ICO con le immagini PNG incorporate (supportato da tutti i browser attuali). */
function ico(pngs) {
    const header = Buffer.alloc(6 + 16 * pngs.length)
    header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4)
    let offset = header.length
    pngs.forEach(({ size, data }, i) => {
        const e = 6 + i * 16
        header.writeUInt8(size >= 256 ? 0 : size, e); header.writeUInt8(size >= 256 ? 0 : size, e + 1)
        header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6)
        header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12)
        offset += data.length
    })
    return Buffer.concat([header, ...pngs.map(p => p.data)])
}

const png = (source, size, background) => {
    let img = sharp(Buffer.from(source), { density: Math.max(72, size * 2) }).resize(size, size)
    if (background) img = img.flatten({ background })
    return img.png({ compressionLevel: 9 }).toBuffer()
}

const assets = join(root, 'client', 'src', 'assets', 'logo')
const pub = join(root, 'client', 'public')
mkdirSync(assets, { recursive: true })

const label = 'Chi Comanda'
const maitreLight = svg(maitre(VARIANTS.light), label)
const coupeLight = svg(coupe(VARIANTS.light), label)
writeFileSync(join(assets, 'maitre-light.svg'), maitreLight)
writeFileSync(join(assets, 'maitre-dark.svg'), svg(maitre(VARIANTS.dark), label))
writeFileSync(join(pub, 'favicon.svg'), coupeLight)
writeFileSync(join(pub, 'favicon.ico'), ico(await Promise.all([16, 32, 48].map(async size => ({ size, data: await png(coupeLight, size) })))))
// iOS non accetta la trasparenza: sfondo pieno del colore della carta
writeFileSync(join(pub, 'apple-touch-icon.png'), await png(maitreLight, 180, '#EFE5D2'))
writeFileSync(join(pub, 'logo-email.png'), await png(maitreLight, 400))

// Android: icone grandi (altrimenti scala il favicon e si sgrana) e una "maskable", con il logo
// dentro la zona sicura (80% centrale) su fondo pieno, che il sistema può ritagliare a cerchio o squircle.
const PAPER = '#EFE5D2'
writeFileSync(join(pub, 'icon-192.png'), await png(maitreLight, 192))
writeFileSync(join(pub, 'icon-512.png'), await png(maitreLight, 512))
const inner = await png(maitreLight, 410)
writeFileSync(join(pub, 'icon-maskable-512.png'), await sharp({ create: { width: 512, height: 512, channels: 4, background: PAPER } })
    .composite([{ input: inner, left: 51, top: 51 }]).png({ compressionLevel: 9 }).toBuffer())
writeFileSync(join(pub, 'manifest.webmanifest'), JSON.stringify({
    name: 'Chi Comanda',
    short_name: 'Chi Comanda',
    description: 'Ordini, bar e cassa per i tuoi eventi',
    lang: 'it',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: PAPER,
    theme_color: '#F8F1E3',
    icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
}, null, 2) + '\n')

console.log('Logo generato in client/src/assets/logo e client/public')
