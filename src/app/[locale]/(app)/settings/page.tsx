'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { Globe, Bell, Shield, Moon, Sun, ChevronRight, Check, Download, Trash2, ScrollText, AlertTriangle } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
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

interface AuditLogEntry {
  action: string
  timestamp: string
}

function getAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('mugdm-audit-log')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [showAuditLog, setShowAuditLog] = useState(false)

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

  // Load audit logs
  useEffect(() => {
    setAuditLogs(getAuditLogs())
  }, [showAuditLog])

  // Data export handler
  const handleExportData = useCallback(async () => {
    setIsExporting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .single() as unknown as { data: Record<string, unknown> | null }

      const businessId = (business as { id?: string })?.id

      let documents: unknown[] = []
      let obligations: unknown[] = []
      let transactions: unknown[] = []
      let teamMembers: unknown[] = []

      if (businessId) {
        const [docsRes, oblRes, txRes, teamRes] = await Promise.all([
          supabase.from('documents').select('*').eq('business_id', businessId) as unknown as Promise<{ data: unknown[] | null }>,
          supabase.from('obligations').select('*').eq('business_id', businessId) as unknown as Promise<{ data: unknown[] | null }>,
          supabase.from('transactions').select('*').eq('business_id', businessId) as unknown as Promise<{ data: unknown[] | null }>,
          supabase.from('team_members').select('*').eq('business_id', businessId) as unknown as Promise<{ data: unknown[] | null }>,
        ])
        documents = docsRes.data ?? []
        obligations = oblRes.data ?? []
        transactions = txRes.data ?? []
        teamMembers = teamRes.data ?? []
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        user: { id: user.id, email: user.email },
        business,
        documents,
        obligations,
        transactions,
        teamMembers,
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mugdm-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Add audit log
      const logs = getAuditLogs()
      logs.unshift({ action: 'Exported all data', timestamp: new Date().toISOString() })
      localStorage.setItem('mugdm-audit-log', JSON.stringify(logs.slice(0, 100)))
    } finally {
      setIsExporting(false)
    }
  }, [])

  // Account deletion handler
  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true)
    try {
      const supabase = createClient()
      // Sign the user out — actual deletion needs server-side admin API
      // For now we sign out and clear local data
      localStorage.clear()
      await supabase.auth.signOut()
      router.replace('/')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }, [router])

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

      {/* Data Management */}
      <SettingSection icon={Download} title={t('dataManagement')}>
        <SettingRow
          label={t('exportAllData')}
          description={t('exportAllDataDesc')}
        >
          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-3 disabled:opacity-50"
          >
            {isExporting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-foreground border-t-transparent" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {t('exportAllData')}
          </button>
        </SettingRow>
      </SettingSection>

      {/* Audit Log */}
      <SettingSection icon={ScrollText} title={t('auditLog')}>
        <div className="py-3">
          <button
            type="button"
            onClick={() => setShowAuditLog((p) => !p)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <ScrollText className="h-3.5 w-3.5" />
            {showAuditLog ? t('hideAuditLog') : t('showAuditLog')}
          </button>

          <AnimatePresence>
            {showAuditLog && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-4 rounded-lg bg-surface-2/50 px-3 py-2"
                      >
                        <span className="text-xs text-foreground">{log.action}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-SA', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('noAuditLogs')}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SettingSection>

      {/* Security */}
      <SettingSection icon={Shield} title={t('security')}>
        <SettingRow
          label={t('deleteAccount')}
          description={t('deleteAccountWarning')}
        >
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('deleteAccount')}
          </button>
        </SettingRow>
      </SettingSection>

      {/* Delete Account Confirmation Dialog */}
      <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
          </Dialog.Overlay>
          <Dialog.Content asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                </div>
                <Dialog.Title className="text-lg font-semibold text-foreground">
                  {t('deleteAccount')}
                </Dialog.Title>
                <p className="text-sm text-muted-foreground">
                  {t('deleteAccountConfirm')}
                </p>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
                  >
                    {t('cancelDelete')}
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                  )}
                  {t('confirmDelete')}
                </button>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
