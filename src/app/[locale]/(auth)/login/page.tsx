'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Link, useRouter } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { ParticleNetwork, TwinklingStars } from '@/lib/animations'

type AuthTab = 'magic_link' | 'password'

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AuthTab>('magic_link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMagicLink = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setIsLoading(false)

    if (authError) {
      setError(t('signInError'))
      return
    }

    setIsSent(true)
  }, [email, t])

  const handlePasswordLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setIsLoading(false)

    if (authError) {
      setError(t('signInError'))
      return
    }

    router.push('/dashboard')
  }, [email, password, t, router])

  if (isSent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
        <div className="pointer-events-none absolute bottom-[-60px] right-[-40px] opacity-[0.04]">
          <Image src="/brand/7-transparent.png" alt="" width={280} height={280} className="brightness-200" aria-hidden="true" />
        </div>
        <div className="relative z-[1] w-full max-w-md space-y-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-3">
            <Image src="/brand/1-transparent.png" alt="Mugdm" width={160} height={48} className="hidden h-12 w-auto dark:block" />
            <Image src="/brand/2-transparent.png" alt="Mugdm" width={160} height={48} className="h-12 w-auto dark:hidden" />
          </Link>
          <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
            <p className="text-lg font-semibold text-foreground">{t('magicLinkSent')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('magicLinkDescription')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      <ParticleNetwork className="z-[0]" density={25000} opacity={0.12} lineOpacity={0.04} speed={0.2} />
      <TwinklingStars count={25} className="z-[0]" />
      {/* Shadda watermark */}
      <div className="pointer-events-none absolute bottom-[-60px] right-[-40px] opacity-[0.04]">
        <Image src="/brand/logo-shadda.png" alt="" width={280} height={280} className="brightness-200" aria-hidden="true" />
      </div>

      <div className="relative z-[1] w-full max-w-md space-y-8">
        {/* Brand logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-3 mb-6">
            <Image src="/brand/1-transparent.png" alt="Mugdm" width={160} height={48} className="hidden h-12 w-auto dark:block" />
            <Image src="/brand/2-transparent.png" alt="Mugdm" width={160} height={48} className="h-12 w-auto dark:hidden" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {t('signInTitle')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('signInSubtitle')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          {/* Auth method tabs */}
          <div className="mb-6 flex rounded-lg border border-border bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => { setActiveTab('magic_link'); setError(null) }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'magic_link'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('tabMagicLink')}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('password'); setError(null) }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'password'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('tabPassword')}
            </button>
          </div>

          {activeTab === 'magic_link' ? (
            <form className="space-y-6" onSubmit={handleMagicLink}>
              <div>
                <label
                  htmlFor="email-magic"
                  className="block text-sm font-medium text-foreground"
                >
                  {t('email')}
                </label>
                <input
                  id="email-magic"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className="mt-1 block w-full rounded-lg border border-input bg-surface-2 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? t('sendMagicLink') + '...' : t('sendMagicLink')}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handlePasswordLogin}>
              <div>
                <label
                  htmlFor="email-password"
                  className="block text-sm font-medium text-foreground"
                >
                  {t('email')}
                </label>
                <input
                  id="email-password"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className="mt-1 block w-full rounded-lg border border-input bg-surface-2 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  {t('password')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  className="mt-1 block w-full rounded-lg border border-input bg-surface-2 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? t('signIn') + '...' : t('signIn')}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t('noAccount')}{' '}
            <Link
              href="/signup"
              className="font-medium text-primary hover:underline"
            >
              {t('signUp')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
