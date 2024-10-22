import Mailjet from "node-mailjet"

interface EmailOptions {
  to: string
  subject: string
  HTMLPart: string
}

const mailjet = new Mailjet({
  apiKey: process.env.MAIL_API_KEY || '',
  apiSecret: process.env.MAIL_API_SECRET || ''
});

const sendEmail = async (options: EmailOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: process.env.MAIL_FROM,
              Name: process.env.MAIL_FROM_NAME
            },
            To: [
              {
                Email: options.to
              }
            ],
            Subject: options.subject,
            HTMLPart: options.HTMLPart
          }
        ]
      })

    request
      .then((result) => {
        resolve()
      })
      .catch((err) => {
        reject(err)
      })
  })
}


export default sendEmail;