'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Users,
  Phone,
  Palette,
  Pencil,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Loader2,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/upload/FileUpload'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/lib/supabase/types'

/* ───────── Types ───────── */

interface Owner {
  name: string
  nationality: string
  share: number
}

type SectionKey = 'identity' | 'ownership' | 'contact' | 'branding'

/* ───────── Constants ───────── */

const NOT_SET_PLACEHOLDER = '---'

const SECTION_ICONS: Record<SectionKey, typeof Building2> = {
  identity: Building2,
  ownership: Users,
  contact: Phone,
  branding: Palette,
}

/* ───────── Section Card ───────── */

function SectionCard({
  sectionKey,
  title,
  isExpanded,
  isEditing,
  onToggleExpand,
  onToggleEdit,
  onSave,
  isSaving,
  children,
  editContent,
}: {
  sectionKey: SectionKey
  title: string
  isExpanded: boolean
  isEditing: boolean
  onToggleExpand: () => void
  onToggleEdit: () => void
  onSave: () => void
  isSaving: boolean
  children: React.ReactNode
  editContent: React.ReactNode
}) {
  const tProfile = useTranslations('profile')
  const Icon = SECTION_ICONS[sectionKey]

  return (
    <motion.div
      layout
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-surface-2/50"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && !isEditing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleEdit()
                }}
                className="gap-1.5 text-primary"
              >
                <Pencil className="h-3.5 w-3.5" />
                {tProfile('editProfile')}
              </Button>
            </motion.div>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="border-t border-border px-5 py-5">
              {isEditing ? (
                <div className="space-y-4">
                  {editContent}
                  <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onToggleEdit}
                      disabled={isSaving}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      {tProfile('cancelEdit')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={onSave}
                      disabled={isSaving}
                      className="gap-1.5"
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {tProfile('saveChanges')}
                    </Button>
                  </div>
                </div>
              ) : (
                children
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ───────── Field Display ───────── */

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-medium text-end',
          value ? 'text-foreground' : 'text-muted-foreground/50'
        )}
      >
        {value || NOT_SET_PLACEHOLDER}
      </span>
    </div>
  )
}

/* ───────── Main Page ───────── */

export default function ProfilePage() {
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    identity: true,
    ownership: false,
    contact: false,
    branding: false,
  })
  const [editing, setEditing] = useState<Record<SectionKey, boolean>>({
    identity: false,
    ownership: false,
    contact: false,
    branding: false,
  })
  const [saving, setSaving] = useState<Record<SectionKey, boolean>>({
    identity: false,
    ownership: false,
    contact: false,
    branding: false,
  })
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null)

  // Edit state mirrors
  const [editIdentity, setEditIdentity] = useState({
    name_ar: '',
    name_en: '',
    cr_number: '',
    activity_type: '',
    city: '',
    capital: '',
    cr_issuance_date: '',
    cr_expiry_date: '',
  })
  const [editOwners, setEditOwners] = useState<Owner[]>([])
  const [editContact, setEditContact] = useState({
    contact_phone: '',
    contact_email: '',
    contact_address: '',
  })

  function syncEditState(biz: Business) {
    setEditIdentity({
      name_ar: biz.name_ar || '',
      name_en: biz.name_en || '',
      cr_number: biz.cr_number || '',
      activity_type: biz.activity_type || '',
      city: biz.city || '',
      capital: biz.capital ? String(biz.capital) : '',
      cr_issuance_date: biz.cr_issuance_date || '',
      cr_expiry_date: biz.cr_expiry_date || '',
    })
    setEditOwners(
      (biz.owners as Owner[] | null) || [{ name: '', nationality: '', share: 100 }]
    )
    setEditContact({
      contact_phone: biz.contact_phone || '',
      contact_email: biz.contact_email || '',
      contact_address: biz.contact_address || '',
    })
  }

  /* ─── Load Business ─── */

  useEffect(() => {
    async function loadBusiness() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data } = (await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .single()) as unknown as { data: Business | null; error: unknown }

      if (data) {
        setBusiness(data)
        syncEditState(data)
      } else {
        router.push(`/${locale}/onboarding`)
        return
      }
      setIsLoading(false)
    }

    loadBusiness()
  }, [router, locale])

  /* ─── Toggles ─── */

  const handleToggleExpand = useCallback((section: SectionKey) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const handleToggleEdit = useCallback(
    (section: SectionKey) => {
      if (!editing[section] && business) {
        syncEditState(business)
      }
      setEditing((prev) => ({ ...prev, [section]: !prev[section] }))
    },
    [editing, business]
  )

  /* ─── Save Section ─── */

  const handleSave = useCallback(
    async (section: SectionKey) => {
      if (!business) return

      setSaving((prev) => ({ ...prev, [section]: true }))

      const supabase = createClient()
      let updatePayload: Record<string, unknown> = {}

      const historyEntry = {
        section,
        timestamp: new Date().toISOString(),
        previous: {} as Record<string, unknown>,
      }

      if (section === 'identity') {
        historyEntry.previous = {
          name_ar: business.name_ar,
          name_en: business.name_en,
          cr_number: business.cr_number,
          activity_type: business.activity_type,
          city: business.city,
          capital: business.capital,
          cr_issuance_date: business.cr_issuance_date,
          cr_expiry_date: business.cr_expiry_date,
        }
        updatePayload = {
          name_ar: editIdentity.name_ar,
          name_en: editIdentity.name_en || null,
          cr_number: editIdentity.cr_number,
          activity_type: editIdentity.activity_type || null,
          city: editIdentity.city || null,
          capital: editIdentity.capital ? Number(editIdentity.capital) : null,
          cr_issuance_date: editIdentity.cr_issuance_date || null,
          cr_expiry_date: editIdentity.cr_expiry_date || null,
        }
      } else if (section === 'ownership') {
        historyEntry.previous = { owners: business.owners }
        updatePayload = {
          owners: editOwners.filter((o) => o.name.trim()),
        }
      } else if (section === 'contact') {
        historyEntry.previous = {
          contact_phone: business.contact_phone,
          contact_email: business.contact_email,
          contact_address: business.contact_address,
        }
        updatePayload = {
          contact_phone: editContact.contact_phone || null,
          contact_email: editContact.contact_email || null,
          contact_address: editContact.contact_address || null,
        }
      }

      const existingHistory = (business.profile_history as Record<string, unknown>[]) || []

      const fullUpdate = {
        ...updatePayload,
        profile_history: [...existingHistory, historyEntry],
      }

      // NOTE: Supabase typed client resolves .update() param to `never` with
      // this @supabase/ssr version. Casting through `unknown` at the boundary.
      const { data, error } = (await supabase.from('businesses')
        .update(fullUpdate as never)
        .eq('id', business.id)
        .select()
        .single()) as unknown as { data: Business | null; error: unknown }

      setSaving((prev) => ({ ...prev, [section]: false }))

      if (error) {
        setToast({ message: t('profileError'), isError: true })
      } else if (data) {
        setBusiness(data)
        syncEditState(data)
        setEditing((prev) => ({ ...prev, [section]: false }))
        setToast({ message: t('profileSaved'), isError: false })
      }

      setTimeout(() => setToast(null), 3000)
    },
    [business, editIdentity, editOwners, editContact, t]
  )

  /* ─── Branding Save ─── */

  const handleBrandingSave = useCallback(
    async (field: 'logo_url' | 'stamp_url', url: string) => {
      if (!business) return

      const supabase = createClient()
      const existingHistory = (business.profile_history as Record<string, unknown>[]) || []

      const brandingUpdate = {
        [field]: url,
        profile_history: [
          ...existingHistory,
          {
            section: 'branding',
            timestamp: new Date().toISOString(),
            previous: { [field]: business[field] },
          },
        ],
      }

      const { data } = (await supabase.from('businesses')
        .update(brandingUpdate as never)
        .eq('id', business.id)
        .select()
        .single()) as unknown as { data: Business | null; error: unknown }

      if (data) {
        setBusiness(data)
        setToast({ message: t('profileSaved'), isError: false })
        setTimeout(() => setToast(null), 3000)
      }
    },
    [business, t]
  )

  /* ─── Loading State ─── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!business) return null

  const owners = (business.owners as Owner[] | null) || []

  /* ─── Render ─── */

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>
        {business.updated_at && (
          <p className="hidden text-xs text-muted-foreground sm:block">
            {t('lastUpdated')}:{' '}
            {new Date(business.updated_at).toLocaleDateString()}
          </p>
        )}
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
              toast.isError
                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                : 'border-green-500/30 bg-green-500/10 text-green-400'
            )}
          >
            <Check className="h-4 w-4" />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Identity Section ─── */}
      <SectionCard
        sectionKey="identity"
        title={t('title')}
        isExpanded={expanded.identity}
        isEditing={editing.identity}
        onToggleExpand={() => handleToggleExpand('identity')}
        onToggleEdit={() => handleToggleEdit('identity')}
        onSave={() => handleSave('identity')}
        isSaving={saving.identity}
        editContent={
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('companyNameAr')} <span className="text-red-400">*</span>
              </label>
              <Input
                value={editIdentity.name_ar}
                onChange={(e) =>
                  setEditIdentity((p) => ({ ...p, name_ar: e.target.value }))
                }
                dir="rtl"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('companyNameEn')}
              </label>
              <Input
                value={editIdentity.name_en}
                onChange={(e) =>
                  setEditIdentity((p) => ({ ...p, name_en: e.target.value }))
                }
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('crNumber')} <span className="text-red-400">*</span>
              </label>
              <Input
                value={editIdentity.cr_number}
                onChange={(e) =>
                  setEditIdentity((p) => ({
                    ...p,
                    cr_number: e.target.value.replace(/\D/g, '').slice(0, 10),
                  }))
                }
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('activityType')}
              </label>
              <Input
                value={editIdentity.activity_type}
                onChange={(e) =>
                  setEditIdentity((p) => ({
                    ...p,
                    activity_type: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('city')}
              </label>
              <Input
                value={editIdentity.city}
                onChange={(e) =>
                  setEditIdentity((p) => ({ ...p, city: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('capital')}
              </label>
              <Input
                value={editIdentity.capital}
                onChange={(e) =>
                  setEditIdentity((p) => ({
                    ...p,
                    capital: e.target.value.replace(/\D/g, ''),
                  }))
                }
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('crIssueDate')}
              </label>
              <Input
                type="date"
                value={editIdentity.cr_issuance_date}
                onChange={(e) =>
                  setEditIdentity((p) => ({
                    ...p,
                    cr_issuance_date: e.target.value,
                  }))
                }
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('crExpiryDate')}
              </label>
              <Input
                type="date"
                value={editIdentity.cr_expiry_date}
                onChange={(e) =>
                  setEditIdentity((p) => ({
                    ...p,
                    cr_expiry_date: e.target.value,
                  }))
                }
                dir="ltr"
              />
            </div>
          </div>
        }
      >
        <div className="divide-y divide-border/50">
          <FieldRow label={t('companyNameAr')} value={business.name_ar} />
          <FieldRow label={t('companyNameEn')} value={business.name_en} />
          <FieldRow label={t('crNumber')} value={business.cr_number} />
          <FieldRow label={t('activityType')} value={business.activity_type} />
          <FieldRow label={t('city')} value={business.city} />
          <FieldRow
            label={t('capital')}
            value={
              business.capital
                ? `${business.capital.toLocaleString()} ${tCommon('sar')}`
                : null
            }
          />
          <FieldRow label={t('crIssueDate')} value={business.cr_issuance_date} />
          <FieldRow label={t('crExpiryDate')} value={business.cr_expiry_date} />
        </div>
      </SectionCard>

      {/* ─── Ownership Section ─── */}
      <SectionCard
        sectionKey="ownership"
        title={t('shareCapital')}
        isExpanded={expanded.ownership}
        isEditing={editing.ownership}
        onToggleExpand={() => handleToggleExpand('ownership')}
        onToggleEdit={() => handleToggleEdit('ownership')}
        onSave={() => handleSave('ownership')}
        isSaving={saving.ownership}
        editContent={
          <div className="space-y-3">
            {editOwners.map((owner, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <Input
                    value={owner.name}
                    onChange={(e) => {
                      const next = [...editOwners]
                      next[index] = { ...next[index], name: e.target.value }
                      setEditOwners(next)
                    }}
                    placeholder={tCommon('name')}
                  />
                  <Input
                    value={owner.nationality}
                    onChange={(e) => {
                      const next = [...editOwners]
                      next[index] = {
                        ...next[index],
                        nationality: e.target.value,
                      }
                      setEditOwners(next)
                    }}
                    placeholder={tCommon('nationality')}
                  />
                  <Input
                    value={owner.share ? String(owner.share) : ''}
                    onChange={(e) => {
                      const next = [...editOwners]
                      next[index] = {
                        ...next[index],
                        share: Number(e.target.value.replace(/\D/g, '')),
                      }
                      setEditOwners(next)
                    }}
                    placeholder="%"
                    dir="ltr"
                    inputMode="numeric"
                  />
                </div>
                {editOwners.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditOwners((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                    className="mt-3 rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setEditOwners((prev) => [
                  ...prev,
                  { name: '', nationality: '', share: 0 },
                ])
              }
              className="gap-1.5 text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              {tCommon('addOwner')}
            </Button>
          </div>
        }
      >
        {owners.length > 0 ? (
          <div className="space-y-3">
            {owners.map((owner, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-surface-2/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {owner.name || NOT_SET_PLACEHOLDER}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {owner.nationality || NOT_SET_PLACEHOLDER}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {owner.share}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{NOT_SET_PLACEHOLDER}</p>
        )}
      </SectionCard>

      {/* ─── Contact Section ─── */}
      <SectionCard
        sectionKey="contact"
        title={tCommon('contactInfo')}
        isExpanded={expanded.contact}
        isEditing={editing.contact}
        onToggleExpand={() => handleToggleExpand('contact')}
        onToggleEdit={() => handleToggleEdit('contact')}
        onSave={() => handleSave('contact')}
        isSaving={saving.contact}
        editContent={
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tCommon('phone')}
              </label>
              <Input
                value={editContact.contact_phone}
                onChange={(e) =>
                  setEditContact((p) => ({
                    ...p,
                    contact_phone: e.target.value,
                  }))
                }
                placeholder="+966 5XX XXX XXXX"
                dir="ltr"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tCommon('email')}
              </label>
              <Input
                value={editContact.contact_email}
                onChange={(e) =>
                  setEditContact((p) => ({
                    ...p,
                    contact_email: e.target.value,
                  }))
                }
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tCommon('address')}
              </label>
              <Textarea
                value={editContact.contact_address}
                onChange={(e) =>
                  setEditContact((p) => ({
                    ...p,
                    contact_address: e.target.value,
                  }))
                }
                className="min-h-[80px]"
              />
            </div>
          </div>
        }
      >
        <div className="divide-y divide-border/50">
          <FieldRow
            label={tCommon('phone')}
            value={business.contact_phone}
          />
          <FieldRow
            label={tCommon('email')}
            value={business.contact_email}
          />
          <FieldRow
            label={tCommon('address')}
            value={business.contact_address}
          />
        </div>
      </SectionCard>

      {/* ─── Branding Section ─── */}
      <motion.div
        layout
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        <button
          type="button"
          onClick={() => handleToggleExpand('branding')}
          className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-surface-2/50"
          aria-expanded={expanded.branding}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Palette className="h-4.5 w-4.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {tCommon('branding')}
            </h3>
          </div>
          {expanded.branding ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {expanded.branding && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="border-t border-border px-5 py-5">
                <div className="flex flex-wrap items-start gap-10">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {tCommon('logo')}
                    </p>
                    <FileUpload
                      accept={{
                        'image/png': ['.png'],
                        'image/jpeg': ['.jpg', '.jpeg'],
                      }}
                      maxSize={2 * 1024 * 1024}
                      bucket="logos"
                      path="logos"
                      onUpload={(url) => handleBrandingSave('logo_url', url)}
                      isCircular
                      previewUrl={business.logo_url}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {tCommon('stamp')}
                    </p>
                    <FileUpload
                      accept={{
                        'image/png': ['.png'],
                        'image/jpeg': ['.jpg', '.jpeg'],
                      }}
                      maxSize={2 * 1024 * 1024}
                      bucket="logos"
                      path="stamps"
                      onUpload={(url) => handleBrandingSave('stamp_url', url)}
                      isCircular
                      previewUrl={business.stamp_url}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
