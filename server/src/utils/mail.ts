import { MailerSend, EmailParams, Sender, Recipient } from "mailersend"
import { Personalization } from "mailersend/lib/modules/Email.module";

interface EmailOptions {
  to: string
  subject: string
  templateId: string
  data: any
}

const mailersend = new MailerSend({
    apiKey: process.env.MAIL_API_KEY || '',
})

const sender = new Sender(process.env.MAIL_FROM || '', process.env.MAIL_FROM_NAME || '')

const sendEmail = async (options: EmailOptions) => {
  const recipients = [new Recipient(options.to)]

  const personalization: Personalization[] = [
    {
      email: options.to,
      data: options.data,
    }
  ];
  
  const emailParams = new EmailParams()
    .setFrom(sender)
    .setTo(recipients)
    .setSubject(options.subject)
    .setTemplateId(options.templateId)
    .setPersonalization(personalization)
  
  await mailersend.email.send(emailParams)
}

export default sendEmail;