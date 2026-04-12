'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { Globe, Bell, Shield, Moon, Sun, ChevronRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

const THEME_STORAGE_KEY = 'mugdm-theme'

type Theme = 'light' | 'dark'

interface NotificationPrefs {
  compliance_reminders: boolean
  document_expiry: boolean
  weekly_digest: boolean
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  compliance_reminders: true,
  document_expiry: true,
  weekly_digest: false,
}

function Toggle({
  isOn,
  onToggle,
  label,
  disabled,
}: {
  isOn: boolean
  onToggle: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
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

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS)
  const [theme, setTheme] = useState<Theme>('dark')
  const [isSaving, setIsSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load preferences on mount
  useEffect(() => {
    async function loadPrefs() {
      // Read theme from localStorage immediately (fast, no flash)
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setTheme(storedTheme)
      } else {
        // No stored preference — detect from DOM (server default is 'dark')
        const isDark = document.documentElement.classList.contains('dark')
        setTheme(isDark ? 'dark' : 'light')
      }

      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>

      if (meta.notification_prefs) {
        const stored = meta.notification_prefs as Partial<NotificationPrefs>
        setNotifPrefs({
          compliance_reminders: stored.compliance_reminders ?? DEFAULT_NOTIFICATION_PREFS.compliance_reminders,
          document_expiry: stored.document_expiry ?? DEFAULT_NOTIFICATION_PREFS.document_expiry,
          weekly_digest: stored.weekly_digest ?? DEFAULT_NOTIFICATION_PREFS.weekly_digest,
        })
      }

      // Sync theme from user_metadata if no local value exists
      if (!storedTheme && meta.theme) {
        const syncedTheme = meta.theme as Theme
        setTheme(syncedTheme)
        localStorage.setItem(THEME_STORAGE_KEY, syncedTheme)
      }

      setIsLoading(false)
    }

    loadPrefs()
  }, [])

  const triggerSave = useCallback((prefs: NotificationPrefs, currentTheme: Theme) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        const supabase = createClient()
        await supabase.auth.updateUser({
          data: {
            notification_prefs: prefs,
            theme: currentTheme,
          },
        })
        setShowSaved(true)
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => setShowSaved(false), 2500)
      } finally {
        setIsSaving(false)
      }
    }, 500)
  }, [])

  const handleToggleNotif = useCallback(
    (key: keyof NotificationPrefs) => {
      setNotifPrefs((prev) => {
        const next = { ...prev, [key]: !prev[key] }
        triggerSave(next, theme)
        return next
      })
    },
    [theme, triggerSave]
  )

  const handleThemeChange = useCallback(
    (next: Theme) => {
      setTheme(next)
      localStorage.setItem(THEME_STORAGE_KEY, next)

      // Apply theme to DOM immediately
      if (next === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }

      triggerSave(notifPrefs, next)
    },
    [notifPrefs, triggerSave]
  )

  const handleSwitchLocale = useCallback(() => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar'
    router.replace(pathname, { locale: nextLocale })
  }, [locale, pathname, router])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>
        <AnimatePresence>
          {(showSaved || isSaving) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400"
            >
              {isSaving ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-green-400 border-t-transparent" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {t('settingsSaved')}
            </motion.div>
          )}
        </AnimatePresence>
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
              onClick={() => handleThemeChange('light')}
              disabled={isLoading}
              aria-label={t('lightMode')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              disabled={isLoading}
              aria-label={t('darkMode')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
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
            isOn={notifPrefs.compliance_reminders}
            onToggle={() => handleToggleNotif('compliance_reminders')}
            label={t('complianceReminders')}
            disabled={isLoading}
          />
        </SettingRow>
        <SettingRow label={t('documentExpiry')}>
          <Toggle
            isOn={notifPrefs.document_expiry}
            onToggle={() => handleToggleNotif('document_expiry')}
            label={t('documentExpiry')}
            disabled={isLoading}
          />
        </SettingRow>
        <SettingRow label={t('weeklyDigest')}>
          <Toggle
            isOn={notifPrefs.weekly_digest}
            onToggle={() => handleToggleNotif('weekly_digest')}
            label={t('weeklyDigest')}
            disabled={isLoading}
          />
        </SettingRow>
      </SettingSection>

      {/* Security */}
      <SettingSection icon={Shield} title={t('security')}>
        <SettingRow
          label={t('deleteAccount')}
          description={t('deleteAccountWarning')}
        >
          <button
            type="button"
            disabled
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-400/50 cursor-not-allowed"
          >
            {t('deleteAccount')}
          </button>
        </SettingRow>
      </SettingSection>
    </div>
  )
}
