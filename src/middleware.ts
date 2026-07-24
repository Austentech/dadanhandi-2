import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/client-middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Match all paths except static files, api (handled separately), and _next
    '/((?!_next/static|_next/image|favicon.ico|images|fonts|api/auth/callback).*)',
  ],
}
