'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, AlertCircle, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MIN_PASSWORD_LENGTH = 8
const HAS_NUMBER_PATTERN = /\d/

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'minLength'
  if (!HAS_NUMBER_PATTERN.test(password)) return 'needsNumber'
  return null
}

export default function SetPasswordModal() {
  const t = useTranslations('auth')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const validationError = validatePassword(password)
    if (validationError === 'minLength') {
      setError(t('invalidPassword'))
      return
    }
    if (validationError === 'needsNumber') {
      setError(t('passwordNeedsNumber'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('passwordsMismatch'))
      return
    }

    setIsLoading(true)

    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
    })

    setIsLoading(false)

    if (updateError) {
      setError(t('setPasswordError'))
      return
    }

    setIsSuccess(true)

    // Reload after a brief delay so the layout re-checks user metadata
    setTimeout(() => window.location.reload(), 1500)
  }, [password, confirmPassword, t])

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <Check className="h-6 w-6 text-green-400" />
            </div>
            <p className="text-lg font-semibold text-foreground">{t('passwordSetSuccess')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{t('setPasswordTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('setPasswordDescription')}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
              {t('newPassword')}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('newPasswordPlaceholder')}
              className="mt-1 block w-full rounded-lg border border-input bg-surface-2 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
              {t('confirmPassword')}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPasswordPlaceholder')}
              className="mt-1 block w-full rounded-lg border border-input bg-surface-2 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t('passwordRequirements')}
          </p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? t('settingPassword') : t('setPassword')}
          </button>
        </form>
      </div>
    </div>
  )
}
