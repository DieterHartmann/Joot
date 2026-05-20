import nodemailer from 'nodemailer'

const transport = nodemailer.createTransport({
  host:   process.env.SMTP_HOST ?? 'localhost',
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth:   process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

export async function sendMail(opts: {
  to:      string
  subject: string
  text:    string
  html?:   string
}) {
  await transport.sendMail({
    from:    process.env.SMTP_FROM ?? 'Joot Leave <noreply@joot.local>',
    to:      opts.to,
    subject: opts.subject,
    text:    opts.text,
    html:    opts.html,
  })
}
