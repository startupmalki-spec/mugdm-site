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
  '/terms',
  '/privacy',
  '/opengraph-image',
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

const DEMO_COOKIE_NAME = 'mugdm_demo'
const DEMO_COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

function isDemoAllowed(): boolean {
  return (
    process.env.NEXT_PUBLIC_MUGDM_DEMO_ALLOWED === 'true' ||
    process.env.MUGDM_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_MUGDM_DEMO_MODE === 'true'
  )
}

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Session-scoped demo activation: ?demo=1 on any path sets the cookie
  // and redirects to the clean URL. Gated by the kill-switch env var so
  // prod can hard-disable demo regardless of link shares.
  if (searchParams.get('demo') === '1' && isDemoAllowed()) {
    const clean = new URL(request.url)
    clean.searchParams.delete('demo')
    const res = NextResponse.redirect(clean)
    res.cookies.set(DEMO_COOKIE_NAME, '1', {
      path: '/',
      maxAge: DEMO_COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: true,
      httpOnly: false, // client-side badge + login pre-fill need to read it
    })
    return res
  }

  // Run next-intl locale routing
  const intlResponse = intlMiddleware(request)

  // Skip auth checks for non-auth public pages
  if (isPublicPath(pathname) && !isAuthPage(pathname)) {
    return intlResponse
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured, skip auth (avoids crash in dev)
  if (!supabaseUrl || !supabaseKey) {
    return intlResponse
  }

  // Refresh the session so auth tokens stay alive on every request.
  // We must create the client against the intlResponse so any locale
  // cookies set by next-intl are preserved in the final response.
  await updateSession(request)

  // Re-check the user from the (now-refreshed) cookies on the request.
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
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
    '/((?!api|auth/callback|_next/static|_next/image|brand|favicon\\.ico|favicon\\.png|manifest\\.json|robots\\.txt|sitemap\\.xml|sw\\.js|logo-.*\\.png|cursor-.*\\.png|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.ico$|.*\\.json$|.*\\.js$|.*\\.css$|.*\\.txt$|.*\\.xml$).*)',
  ],
}
