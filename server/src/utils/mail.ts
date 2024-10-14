// email.ts
import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  // Create a transporter with your Gmail credentials
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'ziro84@gmail.com',
      pass: 'xnlmzaztoswilvjh',
    },
  });

  // Compose the email message
  const mailOptions = {
    from: 'ziro84@gmail.com',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

export default sendEmail;