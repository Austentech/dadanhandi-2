import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  return url
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return key
}

export function createAdminClient() {
  return createClient(getBaseUrl(), getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function getServerOrigin(): Promise<string> {
  const headersList = await headers()
  const origin =
    headersList.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  return origin
}
