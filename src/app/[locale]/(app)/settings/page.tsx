'use client'

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { Globe, Bell, Shield, Moon, Sun, ChevronRight } from 'lucide-react'

function Toggle({
  isOn,
  onToggle,
  label,
}: {
  isOn: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        isOn ? 'bg-primary' : 'bg-surface-3'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          isOn ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SettingSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4.5 w-4.5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="mt-4 divide-y divide-border">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const [complianceReminders, setComplianceReminders] = useState(true)
  const [documentExpiry, setDocumentExpiry] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)

  const handleSwitchLocale = useCallback(() => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar'
    router.replace(pathname, { locale: nextLocale })
  }, [locale, pathname, router])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Preferences */}
      <SettingSection icon={Globe} title={t('preferences')}>
        <SettingRow label={t('language')}>
          <button
            type="button"
            onClick={handleSwitchLocale}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-3"
          >
            {locale === 'ar' ? 'العربية' : 'English'}
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
          </button>
        </SettingRow>
        <SettingRow label={t('theme')}>
          <div className="inline-flex items-center gap-1 rounded-lg bg-surface-2 p-0.5">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
          </div>
        </SettingRow>
      </SettingSection>

      {/* Notifications */}
      <SettingSection icon={Bell} title={t('notifications')}>
        <SettingRow label={t('complianceReminders')}>
          <Toggle
            isOn={complianceReminders}
            onToggle={() => setComplianceReminders((v) => !v)}
            label={t('complianceReminders')}
          />
        </SettingRow>
        <SettingRow label={t('documentExpiry')}>
          <Toggle
            isOn={documentExpiry}
            onToggle={() => setDocumentExpiry((v) => !v)}
            label={t('documentExpiry')}
          />
        </SettingRow>
        <SettingRow label={t('weeklyDigest')}>
          <Toggle
            isOn={weeklyDigest}
            onToggle={() => setWeeklyDigest((v) => !v)}
            label={t('weeklyDigest')}
          />
        </SettingRow>
      </SettingSection>

      {/* Security */}
      <SettingSection icon={Shield} title={t('security')}>
        <SettingRow label={t('changePassword')}>
          <button
            type="button"
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-3"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
        </SettingRow>
        <SettingRow
          label={t('deleteAccount')}
          description={t('deleteAccountWarning')}
        >
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            {t('deleteAccount')}
          </button>
        </SettingRow>
      </SettingSection>
    </div>
  )
}
