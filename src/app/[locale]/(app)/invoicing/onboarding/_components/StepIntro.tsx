'use client'

import { useTranslations } from 'next-intl'
import { ShieldCheck, FileCheck2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  consented: boolean
  onConsentChange: (v: boolean) => void
  onNext: () => void
}

export function StepIntro({ consented, onConsentChange, onNext }: Props) {
  const t = useTranslations('invoicing.onboarding.intro')

  const bullets = [
    { icon: KeyRound, key: 'bullet1' },
    { icon: FileCheck2, key: 'bullet2' },
    { icon: ShieldCheck, key: 'bullet3' },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ul className="space-y-3">
        {bullets.map(({ icon: Icon, key }) => (
          <li
            key={key}
            className="flex items-start gap-3 p-4 rounded-lg bg-surface-2 border border-border"
          >
            <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-sm text-foreground">{t(key)}</span>
          </li>
        ))}
      </ul>

      <label className="flex items-start gap-3 cursor-pointer select-none p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-1 w-4 h-4 accent-primary"
        />
        <span className="text-sm text-foreground">{t('consent')}</span>
      </label>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!consented} size="lg">
          {t('continue')}
        </Button>
      </div>
    </div>
  )
}
