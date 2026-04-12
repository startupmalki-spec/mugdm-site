'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, Zap, FileText, ArrowUpRight, Loader2 } from 'lucide-react'

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

export default function BillingPage() {
  const t = useTranslations('billing')
  const [business, setBusiness] = useState<BusinessBilling | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

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

      setBusiness(data as BusinessBilling | null)
      setLoading(false)
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

  const tier = business?.subscription_tier ?? 'free'
  const status = business?.subscription_status ?? 'free'

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
        <h2 className="text-lg font-semibold mb-4">{t('usage')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('aiCalls')}</p>
              <p className="text-xs text-muted-foreground">{t('aiCallsLimit')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('documents')}</p>
              <p className="text-xs text-muted-foreground">{t('documentsLimit')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
