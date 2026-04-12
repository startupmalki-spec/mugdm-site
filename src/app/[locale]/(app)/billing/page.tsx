'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Zap, FileText, ArrowUpRight, Loader2, Users, HardDrive } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { TIER_LIMITS } from '@/lib/usage/tracker'
import type { UsageStats } from '@/lib/usage/tracker'

interface BusinessBilling {
  id: string
  name_ar: string
  name_en: string | null
  stripe_customer_id: string | null
  subscription_status: string | null
  subscription_tier: string | null
}

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
}

function UsageProgressBar({
  current,
  limit,
  label,
  sublabel,
  icon: Icon,
}: {
  current: number
  limit: number | null
  label: string
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const isUnlimited = limit === null
  const percentage = isUnlimited ? 0 : limit > 0 ? Math.min((current / limit) * 100, 100) : 0
  const isHigh = percentage >= 80

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">
              {isUnlimited ? (
                <span>{current} / Unlimited</span>
              ) : (
                <span>
                  {current} / {limit}
                </span>
              )}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
      </div>
      {!isUnlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isHigh ? 'bg-red-500' : 'bg-primary'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  const t = useTranslations('billing')
  const [business, setBusiness] = useState<BusinessBilling | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [usage, setUsage] = useState<UsageStats | null>(null)

  useEffect(() => {
    async function fetchBusiness() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('businesses')
        .select('id, name_ar, name_en, stripe_customer_id, subscription_status, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle()

      const biz = data as BusinessBilling | null
      setBusiness(biz)
      setLoading(false)

      // Fetch usage stats
      if (biz?.id) {
        try {
          const res = await fetch(`/api/usage?businessId=${biz.id}`)
          if (res.ok) {
            const stats = await res.json()
            setUsage(stats)
          }
        } catch {
          // Usage stats are non-critical
        }
      }
    }
    fetchBusiness()
  }, [])

  const handleManageBilling = useCallback(async () => {
    if (!business?.stripe_customer_id) return
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      console.error('Failed to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }, [business])

  const handleUpgrade = useCallback(
    async (priceId: string) => {
      if (!business) return
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId, businessId: business.id }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        }
      } catch {
        console.error('Failed to create checkout session')
      }
    },
    [business]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const tier = (business?.subscription_tier ?? 'free') as keyof typeof TIER_LIMITS
  const status = business?.subscription_status ?? 'free'
  const tierLimits = TIER_LIMITS[tier] ?? TIER_LIMITS.free

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Current Plan */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('currentPlan')}</h2>
            <p className="text-sm text-muted-foreground">
              {TIER_LABELS[tier] ?? tier} &mdash;{' '}
              <span className={status === 'active' ? 'text-green-600' : 'text-muted-foreground'}>
                {status === 'active' ? t('statusActive') : t('statusFree')}
              </span>
            </p>
          </div>
        </div>

        {business?.stripe_customer_id && (
          <button
            type="button"
            onClick={handleManageBilling}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {portalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpRight className="h-4 w-4" />
            )}
            {t('manageBilling')}
          </button>
        )}
      </div>

      {/* Upgrade Options (only show if not on Business tier) */}
      {tier !== 'business' && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">{t('upgradePlan')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {tier === 'free' && (
              <button
                type="button"
                onClick={() =>
                  handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID ?? '')
                }
                className="flex flex-col items-start rounded-lg border border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
              >
                <span className="text-sm font-semibold text-primary">Pro</span>
                <span className="text-xs text-muted-foreground mt-1">
                  SAR 99/mo &mdash; {t('proDescription')}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID ?? '')
              }
              className="flex flex-col items-start rounded-lg border border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
            >
              <span className="text-sm font-semibold text-primary">Business</span>
              <span className="text-xs text-muted-foreground mt-1">
                SAR 299/mo &mdash; {t('businessDescription')}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Usage Stats */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-6">{t('usage')}</h2>
        <div className="space-y-6">
          <UsageProgressBar
            current={usage?.aiCallsToday ?? 0}
            limit={tierLimits.aiCalls}
            label={t('aiCalls')}
            sublabel={t('aiCallsLimit')}
            icon={Zap}
          />
          <UsageProgressBar
            current={usage?.documentsStored ?? 0}
            limit={tierLimits.documents}
            label={t('documents')}
            sublabel={t('documentsLimit')}
            icon={FileText}
          />
          <UsageProgressBar
            current={usage?.teamMembers ?? 0}
            limit={tierLimits.teamMembers}
            label={t('teamMembers')}
            sublabel={t('teamMembersLimit')}
            icon={Users}
          />
          <UsageProgressBar
            current={usage?.storageEstimateMB ?? 0}
            limit={tierLimits.storageMB}
            label={t('storage')}
            sublabel={t('storageLimit')}
            icon={HardDrive}
          />
        </div>

        {/* Tier Comparison */}
        {tier !== 'business' && (
          <div className="mt-6 rounded-lg border border-border bg-surface-1 p-4">
            <h3 className="text-sm font-semibold mb-3">{t('tierComparison')}</h3>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="font-medium text-muted-foreground">{t('feature')}</div>
              <div className="text-center font-medium">Free</div>
              <div className="text-center font-medium">Pro</div>
              <div className="text-center font-medium">Business</div>

              <div className="text-muted-foreground">{t('aiCalls')}</div>
              <div className="text-center">50/{t('day')}</div>
              <div className="text-center">500/{t('day')}</div>
              <div className="text-center">{t('unlimited')}</div>

              <div className="text-muted-foreground">{t('documents')}</div>
              <div className="text-center">50</div>
              <div className="text-center">500</div>
              <div className="text-center">{t('unlimited')}</div>

              <div className="text-muted-foreground">{t('teamMembers')}</div>
              <div className="text-center">5</div>
              <div className="text-center">50</div>
              <div className="text-center">{t('unlimited')}</div>

              <div className="text-muted-foreground">{t('storage')}</div>
              <div className="text-center">100 MB</div>
              <div className="text-center">2 GB</div>
              <div className="text-center">{t('unlimited')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
