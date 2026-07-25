import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { resetPasswordSchema } from '@/lib/validation/schemas'
import { sanitizeString } from '@/lib/security/utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body as { password: string }

    // 1. Validate new password
    const result = resetPasswordSchema.safeParse({
      password,
      confirm_password: body.confirm_password || '',
    })

    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Validation failed.' },
        { status: 400 }
      )
    }

    // Sanitize password (remove any dangerous characters — though passwords should be literal)
    const cleanPassword = sanitizeString(result.data.password)

    // 2. Get current user session
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Your session has expired. Please request a new password reset link.' },
        { status: 401 }
      )
    }

    // 3. Update password (Supabase hashes with bcrypt automatically)
    const { error } = await supabase.auth.updateUser({
      password: cleanPassword,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()

      if (msg.includes('same as old password') || msg.includes('new password should be different')) {
        return NextResponse.json(
          { success: false, message: 'New password must be different from your current password.' },
          { status: 400 }
        )
      }

      if (msg.includes('password')) {
        return NextResponse.json(
          { success: false, message: 'Password does not meet requirements. Use 8+ chars with uppercase, lowercase, number, and special character.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { success: false, message: 'Failed to update password. Please try again.' },
        { status: 500 }
      )
    }

    // 4. Keep the session active — user is now logged in with the new password
    // Don't sign out. The session from the recovery flow is still valid.

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully! You are now logged in.',
      data: { redirectTo: '/?auth=reset-success' },
    })
  } catch (err) {
    console.error('[RESET-PASSWORD ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
