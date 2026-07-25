import { NextResponse } from 'next/server'

// This endpoint is deprecated — password reset uses /api/auth/forgot-password
// Kept for backwards compatibility
export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, message: 'This endpoint is no longer available. Please use "Forgot Password" to reset your password.' },
    { status: 410 }
  )
}
