'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  vatNumber: string
  crNumber: string
  onChange: (next: { vatNumber: string; crNumber: string }) => void
  onNext: () => void
  onBack: () => void
}

export function StepCredentials({
  vatNumber,
  crNumber,
  onChange,
  onNext,
  onBack,
}: Props) {
  const t = useTranslations('invoicing.onboarding.credentials')

  const vatValid = /^\d{15}$/.test(vatNumber)
  const crValid = /^\d{10}$/.test(crNumber)
  const canContinue = vatValid && crValid

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">{t('vatLabel')}</label>
          <Input
            inputMode="numeric"
            maxLength={15}
            placeholder="300000000000003"
            value={vatNumber}
            onChange={(e) =>
              onChange({ vatNumber: e.target.value.replace(/\D/g, ''), crNumber })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">{t('vatHint')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t('crLabel')}</label>
          <Input
            inputMode="numeric"
            maxLength={10}
            placeholder="1010000000"
            value={crNumber}
            onChange={(e) =>
              onChange({ vatNumber, crNumber: e.target.value.replace(/\D/g, '') })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">{t('crHint')}</p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          {t('back')}
        </Button>
        <Button onClick={onNext} disabled={!canContinue} size="lg">
          {t('continue')}
        </Button>
      </div>
    </div>
  )
}
