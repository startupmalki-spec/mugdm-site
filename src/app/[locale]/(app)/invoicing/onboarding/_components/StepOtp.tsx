'use client'

import { useTranslations } from 'next-intl'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  otp: string
  onOtpChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
  isBusy: boolean
  busyLabel: string
  error: string | null
}

export function StepOtp({
  otp,
  onOtpChange,
  onSubmit,
  onBack,
  isBusy,
  busyLabel,
  error,
}: Props) {
  const t = useTranslations('invoicing.onboarding.otp')
  const canContinue = otp.trim().length >= 4 && !isBusy

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
        <li>{t('step1')}</li>
        <li>{t('step2')}</li>
        <li>{t('step3')}</li>
      </ol>

      <a
        href="https://fatoora.zatca.gov.sa/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-primary text-sm hover:underline"
      >
        {t('openPortal')} <ExternalLink className="w-4 h-4" />
      </a>

      <div>
        <label className="block text-sm font-medium mb-2">{t('otpLabel')}</label>
        <Input
          inputMode="numeric"
          placeholder="123456"
          value={otp}
          onChange={(e) => onOtpChange(e.target.value.replace(/\s/g, ''))}
          className="tracking-widest font-mono text-lg"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      {isBusy && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {busyLabel}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isBusy}>
          {t('back')}
        </Button>
        <Button onClick={onSubmit} disabled={!canContinue} size="lg">
          {t('submit')}
        </Button>
      </div>
    </div>
  )
}
