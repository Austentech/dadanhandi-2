/**
 * Email Service
 * Uses Resend (https://resend.com) to send transactional emails.
 * Falls back to console.log in development if RESEND_API_KEY is not set.
 */

import { Resend } from 'resend'

let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

export interface SendEmailParams {
  to: string
  subject: string
  text: string
  from?: string
}

/**
 * Send a plain-text email via Resend.
 * In development without RESEND_API_KEY, logs to console.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const client = getResendClient()
  const from = params.from || 'Dadan Handi <noreply@dadanhandi.com>'

  // Development fallback: log to console
  if (!client) {
    console.log(`\n[EMAIL DEV] To: ${params.to}`)
    console.log(`[EMAIL DEV] From: ${from}`)
    console.log(`[EMAIL DEV] Subject: ${params.subject}`)
    console.log(`[EMAIL DEV] Body: ${params.text}`)
    console.log('[EMAIL DEV] (Set RESEND_API_KEY to send real emails)\n')
    return { success: true }
  }

  try {
    const { error } = await client.emails.send({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    })

    if (error) {
      console.error('[EMAIL] Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[EMAIL] Send error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
