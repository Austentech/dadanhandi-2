/**
 * Email Service
 * Uses Nodemailer with Gmail SMTP to send transactional emails.
 * In development without SMTP env vars, logs to console.
 */

import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

export interface SendEmailParams {
  to: string
  subject: string
  text: string
  from?: string
}

/**
 * Send a plain-text email via SMTP.
 * Falls back to console.log if SMTP is not configured.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const client = getTransporter()
  const from = params.from || process.env.SMTP_FROM || `Dadan Handi <${process.env.SMTP_USER || 'noreply@dadanhandi.com'}>`

  // No SMTP configured — log to console
  if (!client) {
    console.log(`\n[EMAIL DEV] To: ${params.to}`)
    console.log(`[EMAIL DEV] From: ${from}`)
    console.log(`[EMAIL DEV] Subject: ${params.subject}`)
    console.log(`[EMAIL DEV] Body: ${params.text}`)
    console.log('[EMAIL DEV] (Set SMTP_USER + SMTP_PASS env vars to send real emails)\n')
    return { success: true }
  }

  try {
    const info = await client.sendMail({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    })

    console.log('[EMAIL] Sent:', info.messageId)
    return { success: true }
  } catch (err) {
    console.error('[EMAIL] SMTP error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
