import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { resetPasswordSchema } from '@/lib/validation/schemas'

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

    // IMPORTANT: Do NOT sanitize the password — passwords are literal strings.
    // sanitizeString would strip special characters like < > " from passwords,
    // making them not match what the user typed and potentially weaker.
    const newPassword = result.data.password

    // 2. Create Supabase client
    const supabase = await createServerClient()

    // 3. Check for active session (from recovery flow or login)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('[RESET-PASSWORD] getUser error:', userError.message)
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Your session has expired. Please request a new password reset link.' },
        { status: 401 }
      )
    }

    // 4. Update password (Supabase hashes with bcrypt automatically)
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()

      console.error('[RESET-PASSWORD] updateUser error:', {
        message: error.message,
        status: error.status,
      })

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

      if (msg.includes('session') || msg.includes('expired') || msg.includes('token')) {
        return NextResponse.json(
          { success: false, message: 'Your session has expired. Please request a new password reset link.' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { success: false, message: 'Failed to update password. Please try again.' },
        { status: 500 }
      )
    }

    // 5. Keep the session active — do NOT sign out
    // The recovery session remains valid after password update.
    // The user is now logged in with their new password.

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully! You are now logged in.',
      data: { redirectTo: '/?auth=reset-success' },
    })
  } catch (err) {
    console.error('[RESET-PASSWORD UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
