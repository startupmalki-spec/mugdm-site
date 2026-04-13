'use client'

import { useTranslations } from 'next-intl'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

type Phase = 'csr' | 'compliance-check' | 'production-csid' | 'done'

interface Props {
  phase: Phase
  error: string | null
}

export function StepCompliance({ phase, error }: Props) {
  const t = useTranslations('invoicing.onboarding.compliance')

  const phases: { key: Phase; label: string }[] = [
    { key: 'csr', label: t('phaseCsr') },
    { key: 'compliance-check', label: t('phaseCheck') },
    { key: 'production-csid', label: t('phaseProd') },
  ]

  const order: Record<Phase, number> = {
    csr: 0,
    'compliance-check': 1,
    'production-csid': 2,
    done: 3,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ul className="space-y-3">
        {phases.map((p) => {
          const currentIdx = order[phase]
          const thisIdx = order[p.key]
          const isDone = currentIdx > thisIdx
          const isActive = currentIdx === thisIdx && !error
          const isError = currentIdx === thisIdx && !!error

          return (
            <li
              key={p.key}
              className="flex items-center gap-3 p-4 rounded-lg bg-surface-2 border border-border"
            >
              {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {isActive && (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              )}
              {isError && <AlertCircle className="w-5 h-5 text-red-400" />}
              {!isDone && !isActive && !isError && (
                <div className="w-5 h-5 rounded-full border border-border" />
              )}
              <span className="text-sm">{p.label}</span>
            </li>
          )
        })}
      </ul>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
