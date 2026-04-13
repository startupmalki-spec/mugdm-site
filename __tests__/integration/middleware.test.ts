import { describe, it, expect } from 'vitest'

/**
 * Middleware routing logic tests.
 *
 * Since the actual middleware depends on next-intl and Supabase SSR,
 * we extract and test the pure routing functions independently.
 */

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/auth/callback',
  '/terms',
  '/privacy',
]

function isPublicPath(pathname: string): boolean {
  const strippedPath = pathname.replace(/^\/(ar|en)/, '') || '/'
  return PUBLIC_PATHS.some((p) => strippedPath === p || strippedPath.startsWith(p + '/'))
}

function isAuthPage(pathname: string): boolean {
  const strippedPath = pathname.replace(/^\/(ar|en)/, '') || '/'
  return strippedPath === '/login' || strippedPath === '/signup'
}

function getLocaleFromPath(pathname: string): string {
  const match = pathname.match(/^\/(ar|en)/)
  return match ? match[1] : 'ar' // default locale
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

// ---------------------------------------------------------------------------
// Public Path Detection
// ---------------------------------------------------------------------------

describe('isPublicPath', () => {
  it('/ is public', () => expect(isPublicPath('/')).toBe(true))
  it('/ar is public', () => expect(isPublicPath('/ar')).toBe(true))
  it('/en is public', () => expect(isPublicPath('/en')).toBe(true))
  it('/ar/login is public', () => expect(isPublicPath('/ar/login')).toBe(true))
  it('/en/signup is public', () => expect(isPublicPath('/en/signup')).toBe(true))
  it('/en/terms is public', () => expect(isPublicPath('/en/terms')).toBe(true))
  it('/ar/privacy is public', () => expect(isPublicPath('/ar/privacy')).toBe(true))
  it('/ar/dashboard is NOT public', () => expect(isPublicPath('/ar/dashboard')).toBe(false))
  it('/en/bookkeeper is NOT public', () => expect(isPublicPath('/en/bookkeeper')).toBe(false))
})

// ---------------------------------------------------------------------------
// Auth Page Detection
// ---------------------------------------------------------------------------

describe('isAuthPage', () => {
  it('/ar/login is auth page', () => expect(isAuthPage('/ar/login')).toBe(true))
  it('/en/signup is auth page', () => expect(isAuthPage('/en/signup')).toBe(true))
  it('/ar/dashboard is NOT auth page', () => expect(isAuthPage('/ar/dashboard')).toBe(false))
  it('/ is NOT auth page', () => expect(isAuthPage('/')).toBe(false))
})

// ---------------------------------------------------------------------------
// Locale Extraction
// ---------------------------------------------------------------------------

describe('getLocaleFromPath', () => {
  it('extracts "ar" from /ar/dashboard', () => expect(getLocaleFromPath('/ar/dashboard')).toBe('ar'))
  it('extracts "en" from /en/login', () => expect(getLocaleFromPath('/en/login')).toBe('en'))
  it('defaults to "ar" for /', () => expect(getLocaleFromPath('/')).toBe('ar'))
  it('defaults to "ar" for /dashboard', () => expect(getLocaleFromPath('/dashboard')).toBe('ar'))
})

// ---------------------------------------------------------------------------
// App Path Detection (protected routes)
// ---------------------------------------------------------------------------

describe('isAppPath', () => {
  it('/ar/dashboard is an app path', () => expect(isAppPath('/ar/dashboard')).toBe(true))
  it('/en/bookkeeper is an app path', () => expect(isAppPath('/en/bookkeeper')).toBe(true))
  it('/ar/vault is an app path', () => expect(isAppPath('/ar/vault')).toBe(true))
  it('/ is NOT an app path', () => expect(isAppPath('/')).toBe(false))
  it('/ar/login is NOT an app path', () => expect(isAppPath('/ar/login')).toBe(false))
  it('/en/signup is NOT an app path', () => expect(isAppPath('/en/signup')).toBe(false))
  it('/ar/auth/callback is NOT an app path', () => expect(isAppPath('/ar/auth/callback')).toBe(false))
})

// ---------------------------------------------------------------------------
// Auth Routing Logic
// ---------------------------------------------------------------------------

describe('Auth routing decisions', () => {
  function routingDecision(pathname: string, isAuthenticated: boolean): string {
    const locale = getLocaleFromPath(pathname)

    if (isPublicPath(pathname) && !isAuthPage(pathname)) {
      return 'allow' // public, no redirect
    }

    if (isAuthenticated && isAuthPage(pathname)) {
      return `redirect:/${locale}/dashboard`
    }

    if (!isAuthenticated && isAppPath(pathname)) {
      return `redirect:/${locale}/login`
    }

    return 'allow'
  }

  it('unauthenticated user on /ar/dashboard → redirect to /ar/login', () => {
    expect(routingDecision('/ar/dashboard', false)).toBe('redirect:/ar/login')
  })

  it('authenticated user on /en/login → redirect to /en/dashboard', () => {
    expect(routingDecision('/en/login', true)).toBe('redirect:/en/dashboard')
  })

  it('unauthenticated user on / → allow (public)', () => {
    expect(routingDecision('/', false)).toBe('allow')
  })

  it('authenticated user on /ar/bookkeeper → allow', () => {
    expect(routingDecision('/ar/bookkeeper', true)).toBe('allow')
  })

  it('unauthenticated user on /en/terms → allow (public)', () => {
    expect(routingDecision('/en/terms', false)).toBe('allow')
  })
})
