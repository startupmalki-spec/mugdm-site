import { redirect } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'

/**
 * Call from server components inside (app) routes.
 * Redirects unauthenticated users to /login.
 */
export async function requireAuth(locale: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect({ href: '/login', locale })
  }

  return user
}

/**
 * Call from server components inside (auth) routes.
 * Redirects authenticated users to /dashboard.
 */
export async function requireGuest(locale: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect({ href: '/dashboard', locale })
  }
}
