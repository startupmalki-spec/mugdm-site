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
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isValidIqama, maskIqama, isSaudiNational } from '@/lib/validations'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { TeamMember } from '@/lib/supabase/types'

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
}: {
  member: TeamMember
  onEdit: () => void
  onDeactivate: () => void
}) {
  const tTeam = useTranslations('team')
  const isTerminated = member.status === 'TERMINATED'
  const flag =
    NATIONALITY_FLAGS[member.nationality || ''] ||
    NATIONALITY_FLAGS.Saudi

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={cn(
        'group flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-surface-2/30',
        isTerminated && 'opacity-50'
      )}
    >
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
          <p className="text-sm font-semibold text-foreground">{member.name}</p>
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
    </motion.div>
  )
}

/* ───────── Main Page ───────── */

export default function TeamPage() {
  const t = useTranslations('team')
  const tCommon = useTranslations('common')

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

      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .single() as { data: { id: string } | null; error: any }

      if (!biz) {
        setIsLoading(false)
        return
      }

      setBusinessId(biz.id)

      const { data: teamData } = await supabase
        .from('team_members')
        .select('*')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false }) as { data: TeamMember[] | null; error: any }

      if (teamData) setMembers(teamData)
      setIsLoading(false)
    }

    loadTeam()
  }, [])

  /* ─── Computed ─── */

  const activeMembers = members.filter((m) => m.status === 'ACTIVE')
  const terminatedMembers = members.filter((m) => m.status === 'TERMINATED')

  const saudiCount = activeMembers.filter((m) => {
    if (m.iqama_number && isSaudiNational(m.iqama_number)) return true
    return (
      m.nationality?.toLowerCase() === 'saudi' ||
      m.nationality?.toLowerCase() === 'سعودي'
    )
  }).length

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
    // `never` with this @supabase/ssr version. Cast through `any` at boundary.
    const teamTable = supabase.from('team_members') as any

    if (editingMember) {
      const { data } = await teamTable
        .update(payload)
        .eq('id', editingMember.id)
        .select()
        .single() as { data: TeamMember | null; error: any }

      if (data) {
        setMembers((prev) =>
          prev.map((m) => (m.id === data.id ? data : m))
        )
      }
    } else {
      const { data } = await teamTable
        .insert(payload)
        .select()
        .single() as { data: TeamMember | null; error: any }

      if (data) {
        setMembers((prev) => [data, ...prev])
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

    const { data } = await (supabase.from('team_members') as any)
      .update({
        status: 'TERMINATED',
        termination_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', confirmDeactivate.id)
      .select()
      .single() as { data: TeamMember | null; error: any }

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

      {/* Members List */}
      {visibleMembers.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence>
            {visibleMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onEdit={() => handleOpenEdit(member)}
                onDeactivate={() => setConfirmDeactivate(member)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-dashed border-border bg-card p-12 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-4 text-lg font-semibold text-foreground">
            {t('noMembers')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('noMembersDescription')}
          </p>
          <Button onClick={handleOpenAdd} className="mt-6 gap-2">
            <UserPlus className="h-4 w-4" />
            {t('inviteMember')}
          </Button>
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
                    {tCommon('next') === 'Next' ? 'Name' : 'الاسم'}{' '}
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
                    {tCommon('next') === 'Next' ? 'Nationality' : 'الجنسية'}{' '}
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
