import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { completeProfileSchema } from '@/lib/validation/schemas'
import { updateProfile } from '@/services/profile-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const validationResult = completeProfileSchema.safeParse(body)
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Validation failed.' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Please log in to continue.' },
        { status: 401 }
      )
    }

    await updateProfile(user.id, {
      whatsapp_number: body.whatsapp_number,
      area: body.area,
      city: body.city,
      pincode: body.pincode,
      profile_completed: true,
    })

    return NextResponse.json({ success: true, message: 'Profile completed successfully!' })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
