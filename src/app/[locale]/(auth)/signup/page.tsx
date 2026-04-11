'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

export default function SignupPage() {
  const t = useTranslations('auth')

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {t('signUpTitle')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('signUpSubtitle')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <form className="space-y-6">
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
                placeholder={t('emailPlaceholder')}
                className="mt-1 block w-full rounded-lg border border-input bg-surface-2 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              {t('signUp')}
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
