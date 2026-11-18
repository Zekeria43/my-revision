import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

/**
 * Email delivery.
 *  AUTH_EMAIL_MODE=console  → messages are printed to the server log (dev).
 *  AUTH_EMAIL_MODE=smtp     → real delivery through the configured SMTP server.
 *  AUTH_EMAIL_MODE=brevo    → real delivery through the Brevo HTTP API
 *                             (api.brevo.com/v3/smtp/email). The API key is
 *                             read server-side only and is never logged.
 *  In console mode the action handlers also surface the link in the response
 *  so the flow can be completed locally without a provider.
 */

export type EmailMode = 'console' | 'smtp' | 'brevo'

export function emailMode(): EmailMode {
  const mode = process.env.AUTH_EMAIL_MODE
  if (mode === 'smtp') return 'smtp'
  if (mode === 'brevo') return 'brevo'
  return 'console'
}

let transporter: Transporter | null = null

function getTransporter() {
  if (transporter) return transporter
  if (!process.env.SMTP_HOST) return null
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  return transporter
}

export interface MailInput {
  to: string
  subject: string
  text: string
  html?: string
}

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

async function sendBrevo(input: MailInput): Promise<{ delivered: boolean }> {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  if (!apiKey || !senderEmail) {
    console.error('[mail:brevo] BREVO_API_KEY / BREVO_SENDER_EMAIL not configured')
    return { delivered: false }
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: senderEmail,
          name: process.env.BREVO_SENDER_NAME || 'My Revision',
        },
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        ...(input.html ? { htmlContent: input.html } : {}),
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[mail:brevo] delivery failed (${res.status})`, detail.slice(0, 300))
      return { delivered: false }
    }
    return { delivered: true }
  } catch (e) {
    console.error('[mail:brevo] delivery failed', e)
    return { delivered: false }
  }
}

export async function sendMail(input: MailInput): Promise<{ delivered: boolean; consolePreview?: string }> {
  const mode = emailMode()

  if (mode === 'console') {
    const preview = `To: ${input.to}\nSubject: ${input.subject}\n\n${input.text}`
    // eslint-disable-next-line no-console
    console.log('\n───── [MAIL:console] ─────\n' + preview + '\n──────────────────────────\n')
    return { delivered: true, consolePreview: preview }
  }

  if (mode === 'brevo') return sendBrevo(input)

  const from = process.env.SMTP_FROM ?? 'مراجعتي <no-reply@localhost>'
  const tx = getTransporter()
  if (!tx) return { delivered: false }

  try {
    await tx.sendMail({ from, to: input.to, subject: input.subject, text: input.text, html: input.html })
    return { delivered: true }
  } catch (e) {
    console.error('[mail] delivery failed', e)
    return { delivered: false }
  }
}
