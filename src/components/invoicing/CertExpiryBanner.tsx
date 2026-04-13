'use client'

/**
 * CertExpiryBanner — surfaces ZATCA certificate expiry warnings in the
 * invoicing area. Returns null for `healthy` and `missing` (the missing case
 * is handled by the dedicated onboarding gate elsewhere).
 *
 * Variants:
 *   - warning  (≤30 days): amber.
 *   - critical (≤7 days):  red.
 *   - expired:             red, with stronger copy.
 */

import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/routing'
import type { CertStatusKind } from '@/lib/zatca/cert-monitor'

interface CertExpiryBannerProps {
  status: CertStatusKind
  daysUntilExpiry: number | null
}

export default function CertExpiryBanner({
  status,
  daysUntilExpiry,
}: CertExpiryBannerProps) {
  const t = useTranslations('invoicing.certExpiry')

  if (status === 'healthy' || status === 'missing') return null

  const isCritical = status === 'critical' || status === 'expired'

  const containerClass = isCritical
    ? 'border-red-500/30 bg-red-500/10 text-red-100'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-100'

  const Icon = isCritical ? ShieldAlert : AlertTriangle
  const iconClass = isCritical ? 'text-red-400' : 'text-amber-400'

  let title: string
  let body: string
  if (status === 'expired') {
    const daysPast = daysUntilExpiry !== null ? Math.abs(daysUntilExpiry) : 0
    title = t('expiredTitle')
    body = t('expiredBody', { days: daysPast })
  } else if (status === 'critical') {
    title = t('criticalTitle')
    body = t('criticalBody', { days: daysUntilExpiry ?? 0 })
  } else {
    title = t('warningTitle')
    body = t('warningBody', { days: daysUntilExpiry ?? 0 })
  }

  return (
    <div
      role="alert"
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${containerClass}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconClass}`} />
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm opacity-90">{body}</p>
      </div>
      <Link
        href="/invoicing/onboarding?renew=1"
        className={`flex-shrink-0 self-center rounded-lg px-3 py-2 text-sm font-medium transition ${
          isCritical
            ? 'bg-red-500/20 hover:bg-red-500/30'
            : 'bg-amber-500/20 hover:bg-amber-500/30'
        }`}
      >
        {t('renewCta')}
      </Link>
    </div>
  )
}
