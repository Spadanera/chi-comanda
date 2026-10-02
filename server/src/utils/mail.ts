import Mailjet from 'node-mailjet'
import config from '../config'

interface EmailOptions {
    to: string
    subject: string
    html: string
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
            }],
        })
}

/** Branded transactional e-mail with a single call-to-action button. */
export function actionEmail(opts: { title: string, intro: string, action: string, buttonLabel: string, url: string }): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: sans-serif; line-height: 1.5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .button { display: inline-block; padding: 10px 20px; background-color: red; color: #fff; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${opts.title}</h1>
        <p>Ciao,</p>
        <p>${opts.intro}</p>
        <p>${opts.action}</p>
        <a href="${opts.url}" class="button">${opts.buttonLabel}</a>
        <p>Questo link scadrà tra 24 ore, quindi assicurati di completare la procedura entro tale data.</p>
        <p>A presto su Chi Comanda!</p>
        <img width="160" height="160" src="${config.baseUrl}/logo-email.png" alt="Chi Comanda"/>
    </div>
</body>
</html>`
}
