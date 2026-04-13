'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/routing'

interface Props {
  expiresAt: string | null
}

export function StepDone({ expiresAt }: Props) {
  const t = useTranslations('invoicing.onboarding.done')
  const router = useRouter()

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'

  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">{t('subtitle')}</p>
      </div>

      <div className="p-4 rounded-lg bg-surface-2 border border-border inline-block">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {t('expiryLabel')}
        </div>
        <div className="text-lg font-medium mt-1">{expiryLabel}</div>
        <div className="text-xs text-muted-foreground mt-2">{t('reminderNote')}</div>
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          {t('goDashboard')}
        </Button>
        <Button onClick={() => router.push('/calendar')}>{t('goCalendar')}</Button>
      </div>
    </div>
  )
}
