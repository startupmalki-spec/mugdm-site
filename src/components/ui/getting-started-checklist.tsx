'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Upload,
  FolderArchive,
  Calendar,
  Plus,
  Users,
  X,
  Rocket,
} from 'lucide-react'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'

/* ───────── Types ───────── */

interface ChecklistState {
  uploadCR: boolean
  uploadDocument: boolean
  checkCalendar: boolean
  addTransaction: boolean
  addTeamMember: boolean
  showChecklist: boolean
  dismissed: boolean
}

const STORAGE_KEY = 'mugdm-getting-started'

const DEFAULT_STATE: ChecklistState = {
  uploadCR: false,
  uploadDocument: false,
  checkCalendar: false,
  addTransaction: false,
  addTeamMember: false,
  showChecklist: true,
  dismissed: false,
}

/* ───────── Tasks ───────── */

interface Task {
  key: keyof Omit<ChecklistState, 'showChecklist' | 'dismissed'>
  labelKey: string
  icon: typeof Upload
  href: string
}

const TASKS: Task[] = [
  { key: 'uploadCR', labelKey: 'taskUploadCR', icon: Upload, href: '/onboarding' },
  { key: 'uploadDocument', labelKey: 'taskUploadDocument', icon: FolderArchive, href: '/vault' },
  { key: 'checkCalendar', labelKey: 'taskCheckCalendar', icon: Calendar, href: '/calendar' },
  { key: 'addTransaction', labelKey: 'taskAddTransaction', icon: Plus, href: '/bookkeeper' },
  { key: 'addTeamMember', labelKey: 'taskAddTeamMember', icon: Users, href: '/team' },
]

/* ───────── Component ───────── */

export function GettingStartedChecklist() {
  const t = useTranslations('dashboard')
  const [state, setState] = useState<ChecklistState>(DEFAULT_STATE)
  const [collapsed, setCollapsed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    // Session-scoped demo check; hides checklist for the demo session only.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    import('@/lib/demo-mode').then((m) => setIsDemo(m.isDemoModeClient()))
  }, [])

  // Load state from localStorage
  useEffect(() => {
    const init = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setState({ ...DEFAULT_STATE, ...parsed })
        }
      } catch {
        // localStorage not available
      }
      setLoaded(true)
    }
    init()
  }, [])

  // Persist state changes + emit analytics for newly completed steps.
  const updateState = useCallback((updates: Partial<ChecklistState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // localStorage not available
      }
      // Fire onboarding.step_complete for each task that transitioned to true.
      for (const task of TASKS) {
        const before = prev[task.key]
        const after = next[task.key]
        if (!before && after) {
          void import('@/lib/analytics/event-collector').then(({ track }) =>
            track('onboarding.step_complete', { properties: { step: task.key } })
          )
        }
      }
      return next
    })
  }, [])

  const handleDismiss = useCallback(() => {
    updateState({ dismissed: true })
    void import('@/lib/analytics/event-collector').then(({ track }) =>
      track('onboarding.checklist_dismiss')
    )
  }, [updateState])

  const completedCount = TASKS.filter((task) => state[task.key]).length
  const allDone = completedCount === TASKS.length

  // Don't render if dismissed, not loaded, demo session, or not activated
  if (isDemo || !loaded || state.dismissed || !state.showChecklist) return null

  // Auto-dismiss if all tasks done
  if (allDone && !state.dismissed) {
    // Keep showing with a "done" state briefly
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-xl border border-border bg-card shadow-lg"
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-4"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Rocket className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t('gettingStarted')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{TASKS.length} {t('gettingStartedSubtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress ring */}
          <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
            <circle
              cx="14"
              cy="14"
              r="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-surface-3"
            />
            <circle
              cx="14"
              cy="14"
              r="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${(completedCount / TASKS.length) * 69.115} 69.115`}
              strokeLinecap="round"
              className="text-primary transition-all duration-500"
            />
          </svg>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Task List */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 pb-4 pt-2">
              <div className="space-y-1">
                {TASKS.map((task) => {
                  const Icon = task.icon
                  const done = state[task.key]

                  return (
                    <Link
                      key={task.key}
                      href={task.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                        done
                          ? 'opacity-60'
                          : 'hover:bg-surface-2'
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <Icon className={cn('h-4 w-4 shrink-0', done ? 'text-muted-foreground' : 'text-foreground')} />
                      <span
                        className={cn(
                          'text-sm',
                          done
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground'
                        )}
                      >
                        {t(task.labelKey as Parameters<typeof t>[0])}
                      </span>
                    </Link>
                  )
                })}
              </div>

              {/* Dismiss button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDismiss()
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-3 w-3" />
                {t('dismissChecklist')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
