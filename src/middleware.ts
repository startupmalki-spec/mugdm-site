import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'

const intlMiddleware = createMiddleware(routing)

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/auth/callback',
]

function isPublicPath(pathname: string): boolean {
  const strippedPath = pathname.replace(/^\/(ar|en)/, '') || '/'
  return PUBLIC_PATHS.some((p) => strippedPath === p || strippedPath.startsWith(p + '/'))
}

function isAppPath(pathname: string): boolean {
  const strippedPath = pathname.replace(/^\/(ar|en)/, '') || '/'
  return strippedPath.startsWith('/app') || (
    strippedPath !== '/' &&
    strippedPath !== '/login' &&
    strippedPath !== '/signup' &&
    !strippedPath.startsWith('/auth/')
  )
}

function isAuthPage(pathname: string): boolean {
  const strippedPath = pathname.replace(/^\/(ar|en)/, '') || '/'
  return strippedPath === '/login' || strippedPath === '/signup'
}

function getLocaleFromPath(pathname: string): string {
  const match = pathname.match(/^\/(ar|en)/)
  return match ? match[1] : routing.defaultLocale
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Run next-intl locale routing
  const intlResponse = intlMiddleware(request)

  // Skip auth checks for non-auth public pages
  if (isPublicPath(pathname) && !isAuthPage(pathname)) {
    return intlResponse
  }

  // Skip auth checks if Supabase is not configured (demo mode)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return intlResponse
  }

  // Refresh the session so auth tokens stay alive on every request.
  // We must create the client against the intlResponse so any locale
  // cookies set by next-intl are preserved in the final response.
  await updateSession(request)

  // Re-check the user from the (now-refreshed) cookies on the request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            intlResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const locale = getLocaleFromPath(pathname)

  // Authenticated users on login/signup get redirected to the app dashboard
  if (user && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
  }

  // Unauthenticated users on protected routes get redirected to login
  if (!user && isAppPath(pathname)) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
  }

  return intlResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.png|logo-.*\\.png|cursor-.*\\.png|.*\\.svg$).*)',
  ],
}
