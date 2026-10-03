import Mailjet from 'node-mailjet'
import config from '../config'

export interface EmailOptions {
    to: string
    subject: string
    html: string
    /** Plain-text version, for clients that don't show HTML (and spam filters that want one). */
    text?: string
}

let mailjet: Mailjet | undefined

export default async function sendEmail(options: EmailOptions): Promise<void> {
    // Created lazily: the client throws without credentials, which must not prevent the server from starting
    mailjet ??= new Mailjet({ apiKey: config.mail.apiKey, apiSecret: config.mail.apiSecret })
    await mailjet
        .post('send', { version: 'v3.1' })
        .request({
            Messages: [{
                From: { Email: config.mail.from, Name: config.mail.fromName },
                To: [{ Email: options.to }],
                Subject: options.subject,
                HTMLPart: options.html,
                ...(options.text ? { TextPart: options.text } : {}),
            }],
        })
}

// Palette of the app (client/src/plugins/theme.ts, light theme); fonts close to Federo that e-mail clients have
const COLORS = { page: '#EFE5D2', card: '#FFFBF3', line: '#E6D7BB', text: '#2A2522', muted: '#6B625A', primary: '#22427A' }
const TITLE_FONT = "'Futura', 'Century Gothic', 'Trebuchet MS', Arial, sans-serif"
const BODY_FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

export interface ActionEmailOptions {
    to: string
    subject: string
    /** Big heading of the message. */
    title: string
    /** Plain text paragraphs (escaped); the first one usually greets. */
    paragraphs: string[]
    /** Optional highlighted line, e.g. the roles given in a venue: [label, value]. */
    highlight?: [string, string]
    buttonLabel: string
    url: string
    /** Validity of the link, said under the button; omit when the link doesn't expire. */
    expiresInHours?: number
    /** Small print under the button, e.g. what to do if the e-mail was not expected. */
    note?: string
}

/**
 * Transactional e-mail of Chi Comanda with a single call-to-action button: table layout and inline styles (the only
 * ones Gmail and Outlook keep), a link to copy when the button doesn't work, and a plain-text version.
 */
export function actionEmail(o: ActionEmailOptions): EmailOptions {
    const p = (text: string) =>
        `<p style="margin:0 0 16px;font-family:${BODY_FONT};font-size:16px;line-height:24px;color:${COLORS.text};">${escapeHtml(text)}</p>`
    const small = (html: string) =>
        `<p style="margin:0 0 12px;font-family:${BODY_FONT};font-size:13px;line-height:20px;color:${COLORS.muted};">${html}</p>`
    const expiry = o.expiresInHours ? `Il link vale ${o.expiresInHours} ore.` : ''
    const url = escapeHtml(o.url)

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(o.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(o.paragraphs[1] || o.paragraphs[0] || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td align="center" style="padding:0 0 20px;">
      <img src="${escapeHtml(config.baseUrl)}/logo-email.png" width="64" height="64" alt="" style="display:block;border:0;">
      <div style="margin-top:10px;font-family:${TITLE_FONT};font-size:14px;letter-spacing:4px;color:${COLORS.text};">CHI COMANDA</div>
    </td></tr>
    <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:12px;padding:36px 32px;">
      <h1 style="margin:0 0 20px;font-family:${TITLE_FONT};font-size:24px;line-height:32px;font-weight:normal;color:${COLORS.text};">${escapeHtml(o.title)}</h1>
      ${o.paragraphs.map(p).join('\n      ')}
      ${o.highlight ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr>
        <td style="border-left:3px solid ${COLORS.primary};padding:4px 0 4px 12px;font-family:${BODY_FONT};font-size:15px;line-height:22px;color:${COLORS.text};">
          <span style="color:${COLORS.muted};">${escapeHtml(o.highlight[0])}</span><br><strong>${escapeHtml(o.highlight[1])}</strong>
        </td></tr></table>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr>
        <td align="center" bgcolor="${COLORS.primary}" style="border-radius:8px;">
          <a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${BODY_FONT};font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:8px;">${escapeHtml(o.buttonLabel)}</a>
        </td></tr></table>
      ${expiry || o.note ? small(escapeHtml([expiry, o.note].filter(Boolean).join(' '))) : ''}
      ${small(`Se il pulsante non funziona, copia questo indirizzo nel browser:<br><a href="${url}" style="color:${COLORS.primary};word-break:break-all;">${url}</a>`)}
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0;font-family:${BODY_FONT};font-size:12px;line-height:18px;color:${COLORS.muted};">
      Chi Comanda · ordini, bar e cassa per i tuoi eventi
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

    const text = [
        o.title, '',
        ...o.paragraphs.flatMap(par => [par, '']),
        ...(o.highlight ? [`${o.highlight[0]}: ${o.highlight[1]}`, ''] : []),
        `${o.buttonLabel}: ${o.url}`, '',
        ...[expiry, o.note].filter(Boolean),
        '', 'Chi Comanda · ordini, bar e cassa per i tuoi eventi',
    ].join('\n')

    return { to: o.to, subject: o.subject, html, text }
}
