'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Users,
  UserPlus,
  Pencil,
  UserX,
  Eye,
  EyeOff,
  X,
  Loader2,
  Check,
  AlertTriangle,
  Calculator,
  Clock,
  ChevronDown,
  ChevronUp,
  Paperclip,
  FileText,
  CalendarDays,
  Minus,
  Plus,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isValidIqama, maskIqama, isSaudiNational } from '@/lib/validations'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { TeamMember } from '@/lib/supabase/types'
import {
  calculateGOSI,
  calculateTenure,
  getContractExpiryWarning,
  type GOSIContribution,
} from '@/lib/team/gosi-calculator'

/* ───────── Constants ───────── */

const NATIONALITY_FLAGS: Record<string, string> = {
  Saudi: '\u{1F1F8}\u{1F1E6}',
  Egyptian: '\u{1F1EA}\u{1F1EC}',
  Indian: '\u{1F1EE}\u{1F1F3}',
  Pakistani: '\u{1F1F5}\u{1F1F0}',
  Bangladeshi: '\u{1F1E7}\u{1F1E9}',
  Filipino: '\u{1F1F5}\u{1F1ED}',
  Yemeni: '\u{1F1FE}\u{1F1EA}',
  Sudanese: '\u{1F1F8}\u{1F1E9}',
  Jordanian: '\u{1F1EF}\u{1F1F4}',
  Syrian: '\u{1F1F8}\u{1F1FE}',
}

/** Determine if a team member is Saudi based on iqama or nationality */
function isMemberSaudi(member: TeamMember): boolean {
  if (member.iqama_number && isSaudiNational(member.iqama_number)) return true
  return (
    member.nationality?.toLowerCase() === 'saudi' ||
    member.nationality?.toLowerCase() === 'سعودي'
  )
}

/** Format number with commas */
function formatSAR(amount: number): string {
  return amount.toLocaleString('en-SA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

interface MemberForm {
  name: string
  nationality: string
  role: string
  iqama_number: string
  start_date: string
  salary: string
}

const EMPTY_FORM: MemberForm = {
  name: '',
  nationality: '',
  role: '',
  iqama_number: '',
  start_date: '',
  salary: '',
}

/* ───────── Employee Documents & Leave (localStorage) ───────── */

interface EmployeeDocument {
  id: string
  name: string
  type: 'iqama' | 'contract' | 'certificate' | 'other'
  url: string
  uploadedAt: string
}

interface SalaryChange {
  from: number
  to: number
  date: string
}

interface LeaveRecord {
  id: string
  startDate: string
  endDate: string
  type: 'annual' | 'sick'
  days: number
}

interface MemberMeta {
  documents: EmployeeDocument[]
  salaryHistory: SalaryChange[]
  leaves: LeaveRecord[]
}

const ANNUAL_LEAVE_DAYS = 21

function getMemberMetaKey(memberId: string): string {
  return `mugdm-team-meta-${memberId}`
}

function getMemberMeta(memberId: string): MemberMeta {
  if (typeof window === 'undefined') return { documents: [], salaryHistory: [], leaves: [] }
  try {
    const raw = localStorage.getItem(getMemberMetaKey(memberId))
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { documents: [], salaryHistory: [], leaves: [] }
}

function setMemberMeta(memberId: string, meta: MemberMeta) {
  if (typeof window === 'undefined') return
  localStorage.setItem(getMemberMetaKey(memberId), JSON.stringify(meta))
}

function calculateDaysBetween(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1)
}

function getTotalLeaveDays(leaves: LeaveRecord[], type?: 'annual' | 'sick'): number {
  return leaves
    .filter((l) => !type || l.type === type)
    .reduce((sum, l) => sum + l.days, 0)
}

/* ───────── Audit Log Helper ───────── */

function addAuditLog(action: string) {
  if (typeof window === 'undefined') return
  try {
    const key = 'mugdm-audit-log'
    const raw = localStorage.getItem(key)
    const logs: { action: string; timestamp: string }[] = raw ? JSON.parse(raw) : []
    logs.unshift({ action, timestamp: new Date().toISOString() })
    // Keep last 100
    localStorage.setItem(key, JSON.stringify(logs.slice(0, 100)))
  } catch { /* ignore */ }
}

/* ───────── Member Detail Panel ───────── */

function MemberDetailPanel({
  member,
  onClose,
}: {
  member: TeamMember
  onClose: () => void
}) {
  const t = useTranslations('team')
  const tCommon = useTranslations('common')
  const [meta, setMeta] = useState<MemberMeta>(() => getMemberMeta(member.id))
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [leaveType, setLeaveType] = useState<'annual' | 'sick'>('annual')

  const annualUsed = getTotalLeaveDays(meta.leaves, 'annual')
  const sickUsed = getTotalLeaveDays(meta.leaves, 'sick')
  const annualRemaining = Math.max(0, ANNUAL_LEAVE_DAYS - annualUsed)

  const handleAttachDocument = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      // Determine doc type from name
      const nameLower = file.name.toLowerCase()
      let docType: EmployeeDocument['type'] = 'other'
      if (nameLower.includes('iqama') || nameLower.includes('id')) docType = 'iqama'
      else if (nameLower.includes('contract')) docType = 'contract'
      else if (nameLower.includes('cert')) docType = 'certificate'

      const doc: EmployeeDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        type: docType,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
      }

      const updated = { ...meta, documents: [...meta.documents, doc] }
      setMeta(updated)
      setMemberMeta(member.id, updated)
      addAuditLog(`Attached document "${file.name}" to ${member.name}`)
    }
    input.click()
  }, [meta, member.id, member.name])

  const handleAddLeave = useCallback(() => {
    if (!leaveStart || !leaveEnd) return
    const days = calculateDaysBetween(leaveStart, leaveEnd)
    const record: LeaveRecord = {
      id: crypto.randomUUID(),
      startDate: leaveStart,
      endDate: leaveEnd,
      type: leaveType,
      days,
    }
    const updated = { ...meta, leaves: [...meta.leaves, record] }
    setMeta(updated)
    setMemberMeta(member.id, updated)
    addAuditLog(`Recorded ${leaveType} leave for ${member.name}: ${days} days`)
    setShowLeaveForm(false)
    setLeaveStart('')
    setLeaveEnd('')
  }, [leaveStart, leaveEnd, leaveType, meta, member.id, member.name])

  const handleRemoveLeave = useCallback((id: string) => {
    const updated = { ...meta, leaves: meta.leaves.filter((l) => l.id !== id) }
    setMeta(updated)
    setMemberMeta(member.id, updated)
  }, [meta, member.id])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="rounded-xl border border-border bg-card p-5 space-y-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{member.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Documents Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{t('documents')}</span>
          </div>
          <button
            type="button"
            onClick={handleAttachDocument}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Paperclip className="h-3 w-3" />
            {t('attachDocument')}
          </button>
        </div>
        {meta.documents.length > 0 ? (
          <div className="space-y-1.5">
            {meta.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg bg-surface-2/50 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-foreground truncate">{doc.name}</span>
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {t(`docType.${doc.type}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('noDocuments')}</p>
        )}
      </div>

      {/* Salary History */}
      {meta.salaryHistory.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{t('salaryHistory')}</span>
          </div>
          <div className="space-y-1">
            {meta.salaryHistory.map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="font-mono">SAR {formatSAR(change.from)}</span>
                <span className="text-primary">&rarr;</span>
                <span className="font-mono text-foreground">SAR {formatSAR(change.to)}</span>
                <span className="text-muted-foreground/60">
                  {new Date(change.date).toLocaleDateString('en-SA', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Tracking */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{t('leaveBalance')}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLeaveForm((p) => !p)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Plus className="h-3 w-3" />
            {t('recordLeave')}
          </button>
        </div>

        {/* Leave balance bar */}
        <div className="rounded-lg bg-surface-2/50 px-3 py-2 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('annualLeave')}</span>
            <span className="font-medium text-foreground">
              {annualRemaining} / {ANNUAL_LEAVE_DAYS} {t('daysRemaining')}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                annualRemaining > 10 ? 'bg-emerald-500' : annualRemaining > 5 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${(annualRemaining / ANNUAL_LEAVE_DAYS) * 100}%` }}
            />
          </div>
          {sickUsed > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('sickLeave')}</span>
              <span className="font-medium text-foreground">{sickUsed} {t('daysTaken')}</span>
            </div>
          )}
        </div>

        {/* Add leave form */}
        <AnimatePresence>
          {showLeaveForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-lg border border-border p-3 space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveType('annual')}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      leaveType === 'annual'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface-2 text-muted-foreground'
                    )}
                  >
                    {t('annualLeave')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('sick')}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      leaveType === 'sick'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-border bg-surface-2 text-muted-foreground'
                    )}
                  >
                    {t('sickLeave')}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    dir="ltr"
                  />
                  <Input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLeaveForm(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {tCommon('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddLeave}
                    disabled={!leaveStart || !leaveEnd}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {tCommon('save')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leave records */}
        {meta.leaves.length > 0 && (
          <div className="mt-2 space-y-1">
            {meta.leaves.map((leave) => (
              <div
                key={leave.id}
                className="flex items-center justify-between rounded-lg bg-surface-2/30 px-3 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    leave.type === 'annual' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-400'
                  )}>
                    {leave.type === 'annual' ? t('annualLeave') : t('sickLeave')}
                  </span>
                  <span className="text-muted-foreground">
                    {leave.startDate} &mdash; {leave.endDate}
                  </span>
                  <span className="font-medium text-foreground">{leave.days}d</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveLeave(leave.id)}
                  className="rounded p-1 text-muted-foreground hover:text-red-400"
                >
                  <Minus className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ───────── GOSI Summary Card ───────── */

function GOSISummaryCard({
  members,
}: {
  members: TeamMember[]
}) {
  const t = useTranslations('team')

  const activeMembers = members.filter((m) => m.status === 'ACTIVE')

  let totalSaudiGOSI = 0
  let totalNonSaudiGOSI = 0

  for (const member of activeMembers) {
    if (!member.salary) continue
    const saudi = isMemberSaudi(member)
    const gosi = calculateGOSI(member.salary, saudi)
    if (saudi) {
      totalSaudiGOSI += gosi.total
    } else {
      totalNonSaudiGOSI += gosi.total
    }
  }

  const grandTotal = totalSaudiGOSI + totalNonSaudiGOSI

  if (grandTotal === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {t('monthlyGosi')}
        </h3>
      </div>

      <p className="text-2xl font-bold text-foreground">
        SAR {formatSAR(grandTotal)}
      </p>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <span>
            {t('gosiSaudiTotal')}: SAR {formatSAR(totalSaudiGOSI)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          <span>
            {t('gosiNonSaudiTotal')}: SAR {formatSAR(totalNonSaudiGOSI)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ───────── GOSI What-If Simulator ───────── */

function GOSISimulator({
  currentTotal,
}: {
  currentTotal: number
}) {
  const t = useTranslations('team')
  const [simSalary, setSimSalary] = useState('')
  const [simIsSaudi, setSimIsSaudi] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  const simAmount = simSalary ? Number(simSalary) : 0
  const simGosi = simAmount > 0 ? calculateGOSI(simAmount, simIsSaudi) : null
  const newTotal = simGosi ? currentTotal + simGosi.total : currentTotal

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((p) => !p)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {t('gosiSimulator')}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('simulatorPrompt')}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    {t('simulatorSalary')}
                  </label>
                  <Input
                    value={simSalary}
                    onChange={(e) =>
                      setSimSalary(e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="8,000"
                    dir="ltr"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    {t('simulatorNationality')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSimIsSaudi(true)}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        simIsSaudi
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-border bg-surface-2 text-muted-foreground'
                      )}
                    >
                      {t('saudiEmployee')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimIsSaudi(false)}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        !simIsSaudi
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-border bg-surface-2 text-muted-foreground'
                      )}
                    >
                      {t('nonSaudiEmployee')}
                    </button>
                  </div>
                </div>
              </div>

              {simGosi && (
                <div className="rounded-lg bg-surface-2/50 p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('employeeShare')}
                    </span>
                    <span className="font-mono text-foreground">
                      SAR {formatSAR(simGosi.employeeShare)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('employerShare')}
                    </span>
                    <span className="font-mono text-foreground">
                      SAR {formatSAR(simGosi.employerShare)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between text-xs font-semibold">
                    <span className="text-foreground">
                      {t('newMonthlyGosi')}
                    </span>
                    <span className="font-mono text-primary">
                      SAR {formatSAR(newTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('increase')}
                    </span>
                    <span className="font-mono text-yellow-400">
                      +SAR {formatSAR(simGosi.total)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ───────── Saudization Bar ───────── */

function SaudizationBar({
  saudiCount,
  totalCount,
}: {
  saudiCount: number
  totalCount: number
}) {
  const ratio = totalCount > 0 ? Math.round((saudiCount / totalCount) * 100) : 0

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {saudiCount} Saudi / {totalCount} Total ({ratio}%)
        </p>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            ratio >= 70
              ? 'bg-green-500/10 text-green-400'
              : ratio >= 40
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-red-500/10 text-red-400'
          )}
        >
          {ratio}%
        </span>
      </div>
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors',
            ratio >= 70
              ? 'bg-green-500'
              : ratio >= 40
                ? 'bg-yellow-500'
                : 'bg-red-500'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${ratio}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

/* ───────── Member Card ───────── */

function MemberCard({
  member,
  onEdit,
  onDeactivate,
  onShowDetails,
}: {
  member: TeamMember
  onEdit: () => void
  onDeactivate: () => void
  onShowDetails: () => void
}) {
  const tTeam = useTranslations('team')
  const isTerminated = member.status === 'TERMINATED'
  const flag =
    NATIONALITY_FLAGS[member.nationality || ''] ||
    NATIONALITY_FLAGS.Saudi

  const saudi = isMemberSaudi(member)
  const gosi: GOSIContribution | null =
    member.salary ? calculateGOSI(member.salary, saudi) : null

  const tenure = member.start_date ? calculateTenure(member.start_date) : null
  const expiryWarning = member.start_date
    ? getContractExpiryWarning(member.start_date)
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={cn(
        'group rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-surface-2/30',
        isTerminated && 'opacity-50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full text-lg',
              isTerminated ? 'bg-surface-3' : 'bg-primary/10'
            )}
          >
            {flag}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {member.name}
              </p>
              {/* Nationality badge */}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  saudi
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-blue-500/10 text-blue-400'
                )}
              >
                {saudi ? tTeam('saudiEmployee') : tTeam('nonSaudiEmployee')}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {member.role && <span>{member.role}</span>}
              {member.iqama_number && (
                <>
                  <span className="text-border">|</span>
                  <span className="font-mono">
                    {maskIqama(member.iqama_number)}
                  </span>
                </>
              )}
              {tenure && (tenure.years > 0 || tenure.months > 0) && (
                <>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tTeam('yearsMonths', {
                      years: tenure.years,
                      months: tenure.months,
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              isTerminated
                ? 'bg-red-500/10 text-red-400'
                : 'bg-green-500/10 text-green-400'
            )}
          >
            {isTerminated
              ? tTeam('status.disabled')
              : tTeam('status.active')}
          </span>

          {/* Actions */}
          {!isTerminated && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={onShowDetails}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label={tTeam('documents')}
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label={tTeam('role')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDeactivate}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                aria-label={tTeam('removeMember')}
              >
                <UserX className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* GOSI + Contract row */}
      {!isTerminated && (gosi || expiryWarning) && (
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/50 pt-3">
          {gosi && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {tTeam('gosiContribution')}:
              </span>
              <span className="font-mono text-foreground">
                SAR {formatSAR(gosi.total)}
              </span>
              <span className="text-muted-foreground">
                ({tTeam('employeeShare')}: {formatSAR(gosi.employeeShare)} /{' '}
                {tTeam('employerShare')}: {formatSAR(gosi.employerShare)})
              </span>
            </div>
          )}
          {expiryWarning && (
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="h-3 w-3 text-yellow-400" />
              <span className="text-yellow-400">
                {tTeam('contractExpiryWarning', {
                  days: expiryWarning.daysUntilExpiry,
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

/* ───────── Main Page ───────── */

export default function TeamPage() {
  const t = useTranslations('team')
  const tCommon = useTranslations('common')
  const tEmpty = useTranslations('emptyStates')

  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [businessId, setBusinessId] = useState<string | null>(null)

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Confirm deactivation
  const [confirmDeactivate, setConfirmDeactivate] = useState<TeamMember | null>(null)

  // Show terminated toggle
  const [isShowTerminated, setIsShowTerminated] = useState(false)

  // Detail panel
  const [detailMember, setDetailMember] = useState<TeamMember | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  /* ─── Load ─── */

  useEffect(() => {
    async function loadTeam() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data: biz } = (await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .single()) as unknown as { data: { id: string } | null; error: unknown }

      if (!biz) {
        setIsLoading(false)
        return
      }

      setBusinessId(biz.id)

      const { data: teamData } = (await supabase
        .from('team_members')
        .select('*')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false })) as unknown as { data: TeamMember[] | null; error: unknown }

      if (teamData) setMembers(teamData)
      setIsLoading(false)
    }

    loadTeam()
  }, [])

  /* ─── Computed ─── */

  const activeMembers = members.filter((m) => m.status === 'ACTIVE')
  const terminatedMembers = members.filter((m) => m.status === 'TERMINATED')

  const saudiCount = activeMembers.filter((m) => isMemberSaudi(m)).length

  /* ─── GOSI totals for simulator ─── */
  const currentTotalGOSI = activeMembers.reduce((sum, m) => {
    if (!m.salary) return sum
    return sum + calculateGOSI(m.salary, isMemberSaudi(m)).total
  }, 0)

  const visibleMembers = isShowTerminated ? members : activeMembers

  /* ─── Dialog Handlers ─── */

  const handleOpenAdd = useCallback(() => {
    setEditingMember(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setIsDialogOpen(true)
  }, [])

  const handleOpenEdit = useCallback((member: TeamMember) => {
    setEditingMember(member)
    setForm({
      name: member.name,
      nationality: member.nationality || '',
      role: member.role || '',
      iqama_number: member.iqama_number || '',
      start_date: member.start_date || '',
      salary: member.salary ? String(member.salary) : '',
    })
    setFormErrors({})
    setIsDialogOpen(true)
  }, [])

  const handleValidateAndSave = useCallback(async () => {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = tCommon('required')
    if (!form.nationality.trim()) errors.nationality = tCommon('required')
    if (!form.role.trim()) errors.role = tCommon('required')
    if (form.iqama_number && !isValidIqama(form.iqama_number))
      errors.iqama_number =
        tCommon('next') === 'Next'
          ? '10 digits, starts with 1 or 2'
          : '10 أرقام، يبدأ بـ 1 أو 2'
    if (!form.start_date) errors.start_date = tCommon('required')

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    if (!businessId) return

    setIsSaving(true)
    const supabase = createClient()

    const payload = {
      business_id: businessId,
      name: form.name,
      nationality: form.nationality,
      role: form.role,
      iqama_number: form.iqama_number || null,
      start_date: form.start_date,
      salary: form.salary ? Number(form.salary) : null,
      status: 'ACTIVE' as const,
    }

    // NOTE: Supabase typed client resolves .insert()/.update() param to
    // `never` with this @supabase/ssr version. Cast through `unknown` at boundary.

    if (editingMember) {
      // Track salary change in localStorage
      const oldSalary = editingMember.salary
      const newSalary = form.salary ? Number(form.salary) : null
      if (oldSalary && newSalary && oldSalary !== newSalary) {
        const meta = getMemberMeta(editingMember.id)
        meta.salaryHistory.push({
          from: oldSalary,
          to: newSalary,
          date: new Date().toISOString(),
        })
        setMemberMeta(editingMember.id, meta)
        addAuditLog(`Updated salary for ${editingMember.name}: SAR ${formatSAR(oldSalary)} to SAR ${formatSAR(newSalary)}`)
      }

      const { data } = (await supabase.from('team_members')
        .update(payload as never)
        .eq('id', editingMember.id)
        .select()
        .single()) as unknown as { data: TeamMember | null; error: unknown }

      if (data) {
        setMembers((prev) =>
          prev.map((m) => (m.id === data.id ? data : m))
        )
      }
    } else {
      const { data } = (await supabase.from('team_members')
        .insert(payload as never)
        .select()
        .single()) as unknown as { data: TeamMember | null; error: unknown }

      if (data) {
        setMembers((prev) => [data, ...prev])
        addAuditLog(`Added team member ${data.name}`)
      }
    }

    setIsSaving(false)
    setIsDialogOpen(false)
    setToast(editingMember ? t('memberRemoved') : t('inviteSent'))
    setTimeout(() => setToast(null), 3000)
  }, [form, editingMember, businessId, tCommon, t])

  /* ─── Deactivate ─── */

  const handleConfirmDeactivate = useCallback(async () => {
    if (!confirmDeactivate) return

    const supabase = createClient()

    const { data } = (await supabase.from('team_members')
      .update({
        status: 'TERMINATED',
        termination_date: new Date().toISOString().split('T')[0],
      } as never)
      .eq('id', confirmDeactivate.id)
      .select()
      .single()) as unknown as { data: TeamMember | null; error: unknown }

    if (data) {
      setMembers((prev) => prev.map((m) => (m.id === data.id ? data : m)))
    }

    setConfirmDeactivate(null)
    setToast(t('memberRemoved'))
    setTimeout(() => setToast(null), 3000)
  }, [confirmDeactivate, t])

  /* ─── Loading ─── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  /* ─── Render ─── */

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t('inviteMember')}
        </Button>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400"
          >
            <Check className="h-4 w-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saudization Bar */}
      {activeMembers.length > 0 && (
        <SaudizationBar
          saudiCount={saudiCount}
          totalCount={activeMembers.length}
        />
      )}

      {/* GOSI Summary */}
      {activeMembers.length > 0 && (
        <GOSISummaryCard members={members} />
      )}

      {/* GOSI Simulator */}
      {activeMembers.length > 0 && (
        <GOSISimulator currentTotal={currentTotalGOSI} />
      )}

      {/* Members List */}
      {visibleMembers.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence>
            {visibleMembers.map((member) => (
              <div key={member.id} className="space-y-2">
                <MemberCard
                  member={member}
                  onEdit={() => handleOpenEdit(member)}
                  onDeactivate={() => setConfirmDeactivate(member)}
                  onShowDetails={() =>
                    setDetailMember((prev) =>
                      prev?.id === member.id ? null : member
                    )
                  }
                />
                <AnimatePresence>
                  {detailMember?.id === member.id && (
                    <MemberDetailPanel
                      member={member}
                      onClose={() => setDetailMember(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-8 py-16 text-center"
        >
          <Users className="h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-5 text-lg font-semibold text-foreground">
            {tEmpty('noTeamMembers')}
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {tEmpty('noTeamMembersDesc')}
          </p>
          <Button onClick={handleOpenAdd} className="mt-6 gap-2">
            <UserPlus className="h-4 w-4" />
            {tEmpty('addMember')}
          </Button>
          <p className="mt-4 max-w-sm text-xs text-muted-foreground/70">
            {tEmpty('saudizationNote')}
          </p>
        </motion.div>
      )}

      {/* Show Terminated Toggle */}
      {terminatedMembers.length > 0 && (
        <button
          type="button"
          onClick={() => setIsShowTerminated((p) => !p)}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {isShowTerminated ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {isShowTerminated
            ? tCommon('next') === 'Next'
              ? 'Hide terminated'
              : 'إخفاء المنتهية عقودهم'
            : tCommon('next') === 'Next'
              ? `Show terminated (${terminatedMembers.length})`
              : `عرض المنتهية عقودهم (${terminatedMembers.length})`}
        </button>
      )}

      {/* ─── Add/Edit Dialog ─── */}
      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-semibold text-foreground">
                  {editingMember
                    ? tCommon('edit')
                    : t('inviteMember')}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="mt-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {tCommon('name')}{' '}
                    <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    error={formErrors.name}
                  />
                </div>

                {/* Nationality */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {tCommon('nationality')}{' '}
                    <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={form.nationality}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, nationality: e.target.value }))
                    }
                    error={formErrors.nationality}
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t('role')} <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={form.role}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, role: e.target.value }))
                    }
                    error={formErrors.role}
                  />
                </div>

                {/* Iqama Number */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {tCommon('next') === 'Next'
                      ? 'Iqama / ID Number'
                      : 'رقم الإقامة / الهوية'}
                  </label>
                  <Input
                    value={form.iqama_number}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        iqama_number: e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 10),
                      }))
                    }
                    placeholder="1XXXXXXXXX"
                    dir="ltr"
                    inputMode="numeric"
                    error={formErrors.iqama_number}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Start Date */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      {tCommon('next') === 'Next'
                        ? 'Start Date'
                        : 'تاريخ البداية'}{' '}
                      <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="date"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, start_date: e.target.value }))
                      }
                      dir="ltr"
                      error={formErrors.start_date}
                    />
                  </div>

                  {/* Salary */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      {tCommon('next') === 'Next'
                        ? 'Salary (SAR)'
                        : 'الراتب (ريال)'}
                    </label>
                    <Input
                      value={form.salary}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          salary: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                      dir="ltr"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Dialog.Close asChild>
                  <Button variant="ghost">{tCommon('cancel')}</Button>
                </Dialog.Close>
                <Button
                  onClick={handleValidateAndSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {tCommon('save')}
                </Button>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ─── Deactivation Confirmation Dialog ─── */}
      <Dialog.Root
        open={!!confirmDeactivate}
        onOpenChange={(open) => {
          if (!open) setConfirmDeactivate(null)
        }}
      >
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
                  {t('removeMember')}
                </Dialog.Title>
                <p className="text-sm text-muted-foreground">
                  {t('removeConfirm')}
                </p>
                {confirmDeactivate && (
                  <p className="text-sm font-medium text-foreground">
                    {confirmDeactivate.name}
                  </p>
                )}
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <Dialog.Close asChild>
                  <Button variant="ghost">{tCommon('cancel')}</Button>
                </Dialog.Close>
                <Button
                  onClick={handleConfirmDeactivate}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {tCommon('confirm')}
                </Button>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
