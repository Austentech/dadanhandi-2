/**
 * PUT /api/account/profile
 * ------------------------
 * Update the authenticated user's profile.
 * Editable: whatsapp_number, mobile_number, area, city, pincode.
 * NOT editable: email, provider, user_id, full_name.
 *
 * Security:
 *  - Authenticated session required
 *  - Server-side validation with Zod
 *  - Rate limited (10/min per user)
 *  - SECURITY DEFINER RPC ensures ownership
 */

import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { updateProfileSchema } from '@/lib/validation/account-schemas'
import { getAuthenticatedUser } from '@/services/cart-service'

export async function PUT(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const userCheck = checkRateLimit(user.id, 'account_profile_update', {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!userCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many profile updates. Please wait a moment.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const result = updateProfileSchema.safeParse(body)
    if (!result.success) {
      const firstErr = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstErr?.message || 'Invalid input.' },
        { status: 400 },
      )
    }

    const input = result.data

    const { createServerClient } = await import('@/lib/supabase/client-server')
    const supabase = await createServerClient()

    const { data, error: rpcErr } = await supabase.rpc('update_user_profile', {
      p_user_id: user.id,
      p_whatsapp_number: input.whatsapp_number === '' ? null : (input.whatsapp_number ?? null),
      p_mobile_number: input.mobile_number,
      p_area: input.area,
      p_city: input.city,
      p_pincode: input.pincode,
    })

    if (rpcErr || !data?.success) {
      console.error('[ACCOUNT PROFILE] RPC error:', rpcErr?.message)
      return NextResponse.json(
        { success: false, message: 'Unable to update profile. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully.',
    })
  } catch (err) {
    console.error('[ACCOUNT PROFILE] Unexpected error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
