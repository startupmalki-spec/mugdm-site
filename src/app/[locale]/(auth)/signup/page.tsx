'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const t = useTranslations('auth')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setIsLoading(false)

    if (authError) {
      setError(t('signUpError'))
      return
    }

    setIsSent(true)
  }, [name, email, t])

  if (isSent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
        <div className="pointer-events-none absolute bottom-[-60px] right-[-40px] opacity-[0.04]">
          <Image src="/brand/logo-shadda.png" alt="" width={280} height={280} className="brightness-200" aria-hidden="true" />
        </div>
        <div className="relative z-[1] w-full max-w-md space-y-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-3">
            <Image src="/brand/7-transparent.png" alt="" width={500} height={500} className="h-10 w-10 object-contain" />
            <span className="text-3xl font-bold tracking-tight text-foreground">Mugdm</span>
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
      {/* Shadda watermark */}
      <div className="pointer-events-none absolute bottom-[-60px] right-[-40px] opacity-[0.04]">
        <Image src="/brand/logo-shadda.png" alt="" width={280} height={280} className="brightness-200" aria-hidden="true" />
      </div>

      <div className="relative z-[1] w-full max-w-md space-y-8">
        {/* Brand logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-3 mb-6">
            <Image src="/brand/7-transparent.png" alt="" width={500} height={500} className="h-10 w-10 object-contain" />
            <span className="text-3xl font-bold tracking-tight text-foreground">Mugdm</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {t('signUpTitle')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('signUpSubtitle')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground"
              >
                {t('fullName')}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('fullNamePlaceholder')}
                className="mt-1 block w-full rounded-lg border border-input bg-surface-2 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                {t('email')}
              </label>
              <input
                id="email"
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
              {isLoading ? t('signUp') + '...' : t('signUp')}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t('termsAgreement')}{' '}
            <a href="#" className="text-primary hover:underline">
              {t('termsOfService')}
            </a>{' '}
            {t('and')}{' '}
            <a href="#" className="text-primary hover:underline">
              {t('privacyPolicy')}
            </a>
          </p>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t('hasAccount')}{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              {t('signIn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
