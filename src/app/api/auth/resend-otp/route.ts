import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit } from '@/lib/security/rate-limiter'
import { emailSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body as { email: string }

    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'

    const rateCheck = checkDualRateLimit(ip, email, 'otp_request', {
      maxAttempts: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)
      return NextResponse.json(
        { success: false, message: `Please wait ${retrySeconds} seconds before requesting another OTP.` },
        { status: 429 }
      )
    }

    const supabase = await createServerClient()

    const { error } = await supabase.auth.resend({
      type: 'email',
      email: email.toLowerCase(),
    })

    if (error) {
      return NextResponse.json(
        { success: false, message: 'Unable to resend OTP. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'OTP resent successfully!' })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
