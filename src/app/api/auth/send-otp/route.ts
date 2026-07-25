import { NextResponse } from 'next/server'

// This endpoint is deprecated — login now uses email + password
// Kept for backwards compatibility
export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, message: 'This endpoint is no longer available. Please use the login form with your email and password.' },
    { status: 410 }
  )
}
