'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics/posthog'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderArchive, CalendarDays, Calculator, Shield, CalendarCheck, CheckCircle2, Mail } from 'lucide-react'
import { FloatingElements, AuroraBackground, ParticleNetwork, TwinklingStars } from '@/lib/animations'

const onboardingSteps = [
  { icon: Shield, label: 'Securing your vault...', delay: 0 },
  { icon: CalendarCheck, label: 'Setting up compliance tracking...', delay: 1.2 },
  { icon: Calculator, label: 'Preparing your bookkeeper...', delay: 2.4 },
  { icon: CheckCircle2, label: 'Almost ready!', delay: 3.6 },
]

const features = [
  {
    icon: FolderArchive,
    title: 'Document Vault',
    description: 'Securely store your CR, GOSI, and compliance docs',
  },
  {
    icon: CalendarDays,
    title: 'Compliance Calendar',
    description: 'Never miss a renewal deadline again',
  },
  {
    icon: Calculator,
    title: 'AI Bookkeeper',
    description: 'Auto-categorize expenses and track VAT',
  },
]

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

    trackEvent('signup_completed', { method: 'magic_link' })
    setIsSent(true)
  }, [name, email, t])

  if (isSent) {
    return <SentConfirmation t={t} />
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      <ParticleNetwork className="z-[0]" density={25000} opacity={0.12} lineOpacity={0.04} speed={0.2} />
      <TwinklingStars count={25} className="z-[0]" />
      {/* Aurora ambient gradient */}
      <AuroraBackground />

      {/* Floating star particles */}
      <FloatingElements />

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
            {t('signUpTitle')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('signUpSubtitle')}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.8, 0.25, 1] }}
          className="rounded-xl border border-border bg-card p-8 shadow-lg"
        >
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
            <Link href="/terms" className="text-primary hover:underline">
              {t('termsOfService')}
            </Link>{' '}
            {t('and')}{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              {t('privacyPolicy')}
            </Link>
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
        </motion.div>

        {/* Social proof */}
        <p className="text-center text-xs text-muted-foreground">
          Trusted by 100+ Saudi businesses
        </p>

        {/* Feature highlight cards */}
        <div className="grid grid-cols-3 gap-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: [0.25, 0.8, 0.25, 1] }}
              className="bg-card/50 border border-border/50 rounded-lg p-4 text-center"
            >
              <feature.icon className="mx-auto h-5 w-5 text-primary mb-2" />
              <p className="text-xs font-medium text-foreground leading-tight">{feature.title}</p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Animated "magic link sent" confirmation ─── */
function SentConfirmation({ t }: { t: ReturnType<typeof useTranslations<'auth'>> }) {
  const [visibleStep, setVisibleStep] = useState(-1)
  const [showEmail, setShowEmail] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    onboardingSteps.forEach((step, i) => {
      timers.push(setTimeout(() => setVisibleStep(i), step.delay * 1000))
    })

    // Show the final email card after all steps
    timers.push(setTimeout(() => setShowEmail(true), 4.8 * 1000))

    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {/* Aurora ambient gradient */}
      <AuroraBackground />

      {/* Floating star particles */}
      <FloatingElements />

      {/* Shadda watermark */}
      <div className="pointer-events-none absolute bottom-[-60px] right-[-40px] opacity-[0.04]">
        <Image src="/brand/7-transparent.png" alt="" width={280} height={280} className="brightness-200" aria-hidden="true" />
      </div>

      <div className="relative z-[1] w-full max-w-md space-y-8 text-center">
        <Link href="/" className="inline-flex items-center justify-center gap-3">
          <Image src="/brand/1-transparent.png" alt="Mugdm" width={160} height={48} className="hidden h-12 w-auto dark:block" />
          <Image src="/brand/2-transparent.png" alt="Mugdm" width={160} height={48} className="h-12 w-auto dark:hidden" />
        </Link>

        {/* Onboarding progress steps */}
        <div className="space-y-3">
          <AnimatePresence>
            {onboardingSteps.map((step, i) => {
              if (i > visibleStep) return null
              const Icon = step.icon
              const isComplete = i < visibleStep || (i === onboardingSteps.length - 1 && showEmail)
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.8, 0.25, 1] }}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/80 px-4 py-3 text-left"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${isComplete ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4 animate-pulse" />
                    )}
                  </div>
                  <span className={`text-sm transition-colors duration-500 ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                  {/* Progress indicator dot */}
                  {!isComplete && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Final email card */}
        <AnimatePresence>
          {showEmail && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.25, 0.8, 0.25, 1] }}
              className="rounded-xl border border-border bg-card p-8 shadow-lg"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-lg font-semibold text-foreground">{t('magicLinkSent')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('magicLinkDescription')}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
