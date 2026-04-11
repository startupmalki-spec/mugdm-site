import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { createClient } from '@/lib/supabase/server'

const DEFAULT_LOCALE = 'en'
const SUPPORTED_LOCALES = ['en', 'ar']

function getLocaleFromCookies(cookieStore: ReturnType<typeof cookies> extends Promise<infer T> ? T : never): string {
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value
  if (localeCookie && SUPPORTED_LOCALES.includes(localeCookie)) return localeCookie
  return DEFAULT_LOCALE
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const cookieStore = await cookies()
  const locale = getLocaleFromCookies(cookieStore)
  const next = searchParams.get('next') ?? `/${locale}/dashboard`

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
