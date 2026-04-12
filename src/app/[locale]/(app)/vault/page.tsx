'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import {
  Upload,
  Grid3X3,
  List,
  Search,
  X,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  AlertTriangle,
  Eye,
  Archive,
  Clock,
  Filter,
  ArrowUpDown,
  FolderOpen,
  FolderClosed,
  FolderArchive,
  History,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Share2,
  Copy,
  Link2,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ToastContainer, useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  getExpiryStatus,
  getExpiryBadgeColor,
  getDocumentTypeLabel,
  getDocumentTypeIcon,
  getDocumentTypeColor,
  formatFileSize,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/documents'

import { linkDocumentToObligation } from '@/lib/documents/link-to-obligations'

import type { Document, DocumentType } from '@/lib/supabase/types'
import type { ExpiryStatus } from '@/lib/documents'

// --- Types ---

type ViewMode = 'grid' | 'list' | 'folder'
type SortField = 'uploaded_at' | 'expiry_date' | 'type'

interface AnalysisResult {
  type: DocumentType
  confidence: number
  expiryDate: string | null
  registrationNumber: string | null
}

// --- Constants ---

const ALL_DOCUMENT_TYPES: DocumentType[] = [
  'CR', 'GOSI_CERT', 'ZAKAT_CLEARANCE', 'INSURANCE', 'CHAMBER',
  'BALADY', 'MISA', 'LEASE', 'SAUDIZATION_CERT', 'BANK_STATEMENT',
  'TAX_REGISTRATION', 'OTHER',
]

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

// --- Components ---

function StatusBadge({ status, label }: { status: ExpiryStatus; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        getExpiryBadgeColor(status)
      )}
    >
      {label}
    </span>
  )
}

function TypeBadge({ type, locale }: { type: DocumentType; locale: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        getDocumentTypeColor(type)
      )}
    >
      {getDocumentTypeLabel(type, locale)}
    </span>
  )
}

function ExpiryCountdownBadge({
  expiryDate,
  uploadedAt,
}: {
  expiryDate: string | null
  uploadedAt: string
}) {
  const t = useTranslations('vault')

  if (!expiryDate) return null

  const now = new Date()
  const expiry = new Date(expiryDate)
  const uploaded = new Date(uploadedAt)
  const daysLeft = differenceInDays(expiry, now)

  // Calculate progress: ratio of time elapsed vs total lifespan
  const totalLifespan = differenceInDays(expiry, uploaded)
  const elapsed = differenceInDays(now, uploaded)
  const progressPercent = totalLifespan > 0 ? Math.max(0, Math.min(100, (elapsed / totalLifespan) * 100)) : 100

  // Determine color scheme
  let colorClass: string
  let ringColor: string
  let label: string

  if (daysLeft < 0) {
    const daysAgo = Math.abs(daysLeft)
    colorClass = 'bg-red-700/15 text-red-500 border-red-700/20'
    ringColor = 'text-red-500'
    label = daysAgo === 1 ? t('expiry.expiredOneDay') : t('expiry.expiredDaysAgo', { days: daysAgo })
  } else if (daysLeft === 0) {
    colorClass = 'bg-red-500/15 text-red-400 border-red-500/20'
    ringColor = 'text-red-400'
    label = t('expiry.expiresToday')
  } else if (daysLeft < 7) {
    colorClass = 'bg-red-500/15 text-red-400 border-red-500/20'
    ringColor = 'text-red-400'
    label = daysLeft === 1 ? t('expiry.expiresInOneDay') : t('expiry.expiresInDays', { days: daysLeft })
  } else if (daysLeft <= 30) {
    colorClass = 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    ringColor = 'text-amber-400'
    label = t('expiry.expiresInDays', { days: daysLeft })
  } else {
    colorClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    ringColor = 'text-emerald-400'
    label = t('expiry.expiresInDays', { days: daysLeft })
  }

  // Small ring/progress indicator
  const radius = 7
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progressPercent / 100)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        colorClass
      )}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" className={cn('shrink-0', ringColor)}>
        <circle cx="9" cy="9" r={radius} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 9 9)"
        />
      </svg>
      {label}
    </span>
  )
}

function ExpiringSoonBanner({
  count,
  onFilterExpiring,
}: {
  count: number
  onFilterExpiring: () => void
}) {
  const t = useTranslations('vault')

  if (count === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{t('expiry.documentsExpiringSoon')}</p>
          <p className="text-xs text-muted-foreground">
            {t('expiry.documentsExpiringSoonCount', { count })}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onFilterExpiring} className="gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
        <Clock className="h-3.5 w-3.5" />
        {t('expiry.sortExpiringSoonFirst')}
      </Button>
    </motion.div>
  )
}

function DocumentCard({
  doc,
  locale,
  onView,
}: {
  doc: Document
  locale: string
  onView: (doc: Document) => void
}) {
  const t = useTranslations('vault')
  const status = getExpiryStatus(doc.expiry_date)
  const dateLocale = locale === 'ar' ? ar : enUS

  const statusLabel =
    status === 'valid'
      ? t('status.valid')
      : status === 'expiring'
        ? t('status.expiringSoon')
        : status === 'expired'
          ? t('status.expired')
          : ''

  const daysLeft = doc.expiry_date
    ? differenceInDays(new Date(doc.expiry_date), new Date())
    : null

  return (
    <motion.button
      variants={ITEM_VARIANTS}
      type="button"
      onClick={() => onView(doc)}
      className={cn(
        'group flex flex-col rounded-xl border border-border bg-card p-4 text-start transition-all hover:border-primary/30 hover:bg-surface-2',
        !doc.is_current && 'opacity-50'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {getDocumentTypeIcon(doc.type)({ className: 'h-5 w-5' })}
        </div>
        <div className="flex items-center gap-1.5">
          {doc.version_number > 1 && (
            <span className="inline-flex items-center rounded-full bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">
              v{doc.version_number}
            </span>
          )}
          {status !== 'none' && <StatusBadge status={status} label={statusLabel} />}
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm font-medium text-foreground">{doc.name}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TypeBadge type={doc.type} locale={locale} />
        <ExpiryCountdownBadge expiryDate={doc.expiry_date} uploadedAt={doc.uploaded_at} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{format(new Date(doc.uploaded_at), 'dd MMM yyyy', { locale: dateLocale })}</span>
        {formatFileSize(doc.file_size) !== '--' && (
          <span>{formatFileSize(doc.file_size)}</span>
        )}
      </div>
    </motion.button>
  )
}

function DocumentListRow({
  doc,
  locale,
  onView,
}: {
  doc: Document
  locale: string
  onView: (doc: Document) => void
}) {
  const t = useTranslations('vault')
  const status = getExpiryStatus(doc.expiry_date)
  const dateLocale = locale === 'ar' ? ar : enUS

  const statusLabel =
    status === 'valid'
      ? t('status.valid')
      : status === 'expiring'
        ? t('status.expiringSoon')
        : status === 'expired'
          ? t('status.expired')
          : ''

  return (
    <motion.button
      variants={ITEM_VARIANTS}
      type="button"
      onClick={() => onView(doc)}
      className={cn(
        'group flex w-full items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 text-start transition-all hover:border-primary/30 hover:bg-surface-2',
        !doc.is_current && 'opacity-50'
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {getDocumentTypeIcon(doc.type)({ className: 'h-4 w-4' })}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
          {doc.version_number > 1 && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">
              v{doc.version_number}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <TypeBadge type={doc.type} locale={locale} />
          <span className="text-xs text-muted-foreground">
            {formatFileSize(doc.file_size)}
          </span>
        </div>
      </div>

      <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        {format(new Date(doc.uploaded_at), 'dd MMM yyyy', { locale: dateLocale })}
      </div>

      <div className="hidden shrink-0 sm:block">
        <ExpiryCountdownBadge expiryDate={doc.expiry_date} uploadedAt={doc.uploaded_at} />
      </div>

      <div className="shrink-0">
        {status !== 'none' && <StatusBadge status={status} label={statusLabel} />}
      </div>
    </motion.button>
  )
}

type ShareExpiry = 3600 | 86400 | 604800

function ShareDocument({ doc }: { doc: Document }) {
  const t = useTranslations('vault')
  const [isOpen, setIsOpen] = useState(false)
  const [expiry, setExpiry] = useState<ShareExpiry>(86400)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  const expiryOptions: { value: ShareExpiry; label: string }[] = [
    { value: 3600, label: t('share.oneHour') },
    { value: 86400, label: t('share.twentyFourHours') },
    { value: 604800, label: t('share.sevenDays') },
  ]

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(false)
    setSignedUrl(null)
    try {
      const supabase = createClient()
      // Extract the storage path from the file_url
      // file_url is typically: bucket/path/to/file
      const path = doc.file_url
      const { data, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, expiry)

      if (urlError || !data?.signedUrl) {
        setError(true)
      } else {
        setSignedUrl(data.signedUrl)
      }
    } catch {
      setError(true)
    } finally {
      setIsGenerating(false)
    }
  }, [doc.file_url, expiry])

  const handleCopy = useCallback(async () => {
    if (!signedUrl) return
    try {
      await navigator.clipboard.writeText(signedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const input = document.querySelector<HTMLInputElement>('[data-share-url-input]')
      if (input) {
        input.select()
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }, [signedUrl])

  if (!isOpen) {
    return (
      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Share2 className="h-4 w-4" />
          {t('actions.share')}
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-3 overflow-hidden rounded-lg border border-primary/20 bg-primary/5 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">{t('share.title')}</h4>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false)
            setSignedUrl(null)
            setError(false)
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">{t('share.subtitle')}</p>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('share.expiry')}
        </label>
        <div className="flex gap-1 rounded-lg bg-surface-1 p-1">
          {expiryOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setExpiry(opt.value)
                setSignedUrl(null)
              }}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                expiry === opt.value
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!signedUrl ? (
        <Button
          variant="default"
          size="sm"
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          {isGenerating ? t('share.generating') : t('share.generate')}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              data-share-url-input
              type="text"
              readOnly
              value={signedUrl}
              className="h-8 flex-1 rounded-md border border-border bg-surface-1 px-2 text-xs text-foreground focus:outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? t('share.copied') : t('share.copyLink')}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t('share.linkReady')}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{t('share.error')}</p>
      )}
    </motion.div>
  )
}

function DocumentDetailPanel({
  doc,
  locale,
  onClose,
  onArchive,
  allDocuments,
  onView,
}: {
  doc: Document
  locale: string
  onClose: () => void
  onArchive: (doc: Document) => void
  allDocuments: Document[]
  onView: (doc: Document) => void
}) {
  const t = useTranslations('vault')
  const status = getExpiryStatus(doc.expiry_date)
  const dateLocale = locale === 'ar' ? ar : enUS

  const statusLabel =
    status === 'valid'
      ? t('status.valid')
      : status === 'expiring'
        ? t('status.expiringSoon')
        : status === 'expired'
          ? t('status.expired')
          : ''

  return (
    <motion.div
      initial={{ opacity: 0, x: locale === 'ar' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: locale === 'ar' ? -20 : 20 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-primary">
            {getDocumentTypeIcon(doc.type)({ className: 'h-6 w-6' })}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{doc.name}</h3>
            <TypeBadge type={doc.type} locale={locale} />
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('details.fileSize')}</span>
          <span className="text-foreground">{formatFileSize(doc.file_size)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('details.uploadedAt')}</span>
          <span className="text-foreground">
            {format(new Date(doc.uploaded_at), 'dd MMM yyyy', { locale: dateLocale })}
          </span>
        </div>
        {doc.expiry_date && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('details.expiresAt')}</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground">
                {format(new Date(doc.expiry_date), 'dd MMM yyyy', { locale: dateLocale })}
              </span>
              {status !== 'none' && <StatusBadge status={status} label={statusLabel} />}
            </div>
          </div>
        )}
        {doc.ai_confidence !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">AI Confidence</span>
            <span className="text-foreground">{Math.round(doc.ai_confidence * 100)}%</span>
          </div>
        )}
        {doc.archived_at && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Archived</span>
            <span className="text-foreground">
              {format(new Date(doc.archived_at), 'dd MMM yyyy', { locale: dateLocale })}
            </span>
          </div>
        )}
      </div>

      {doc.version_number > 1 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('version')}</span>
          <span className="inline-flex items-center rounded-full bg-indigo-500/15 border border-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-400">
            v{doc.version_number}
          </span>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-2">
          <Eye className="h-4 w-4" />
          {t('actions.view')}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-2">
          <Download className="h-4 w-4" />
          {t('actions.download')}
        </Button>
      </div>

      {/* Share Document */}
      <ShareDocument doc={doc} />

      {!doc.archived_at && (
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-muted-foreground hover:text-red-400"
            onClick={() => onArchive(doc)}
          >
            <Archive className="h-4 w-4" />
            {t('actions.archive')}
          </Button>
        </div>
      )}

      {/* Version History */}
      <VersionHistory doc={doc} locale={locale} allDocuments={allDocuments} onView={onView} />
    </motion.div>
  )
}

function VersionHistory({
  doc,
  locale,
  allDocuments,
  onView,
}: {
  doc: Document
  locale: string
  allDocuments: Document[]
  onView: (doc: Document) => void
}) {
  const t = useTranslations('vault')
  const dateLocale = locale === 'ar' ? ar : enUS

  // Build version chain: walk backwards through previous_version_id
  const versionChain = useMemo(() => {
    const chain: Document[] = [doc]
    let current = doc
    // Walk backwards to find older versions
    while (current.previous_version_id) {
      const prev = allDocuments.find((d) => d.id === current.previous_version_id)
      if (!prev || chain.includes(prev)) break
      chain.push(prev)
      current = prev
    }
    // Also find newer versions that reference this doc
    let newest = doc
    let searching = true
    while (searching) {
      const newer = allDocuments.find((d) => d.previous_version_id === newest.id)
      if (newer && !chain.includes(newer)) {
        chain.unshift(newer)
        newest = newer
      } else {
        searching = false
      }
    }
    return chain
  }, [doc, allDocuments])

  if (versionChain.length <= 1) return null

  return (
    <div className="mt-6">
      <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <History className="h-4 w-4 text-muted-foreground" />
        {t('versionHistory')}
      </h4>
      <div className="mt-3 space-y-0">
        {versionChain.map((v, idx) => {
          const isCurrent = v.id === doc.id
          const isLatest = idx === 0
          return (
            <div key={v.id} className="relative flex gap-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'h-3 w-3 rounded-full border-2 shrink-0',
                    isCurrent
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/40 bg-card'
                  )}
                />
                {idx < versionChain.length - 1 && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>
              {/* Version info */}
              <button
                type="button"
                onClick={() => !isCurrent && onView(v)}
                disabled={isCurrent}
                className={cn(
                  'mb-3 min-w-0 flex-1 rounded-lg px-3 py-2 text-start text-xs transition-colors',
                  isCurrent
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-surface-2 cursor-pointer'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    v{v.version_number}
                  </span>
                  {isLatest && (
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                      {t('currentVersion')}
                    </span>
                  )}
                  {!isLatest && !isCurrent && (
                    <span className="text-muted-foreground">{t('superseded')}</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-muted-foreground">
                  {format(new Date(v.uploaded_at), 'dd MMM yyyy', { locale: dateLocale })}
                  {' - '}
                  {v.name}
                </p>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FolderView({
  documents,
  locale,
  onView,
}: {
  documents: Document[]
  locale: string
  onView: (doc: Document) => void
}) {
  const t = useTranslations('vault')
  const [openFolders, setOpenFolders] = useState<Set<DocumentType>>(new Set())

  // Group documents by type
  const grouped = useMemo(() => {
    const groups: Partial<Record<DocumentType, Document[]>> = {}
    for (const doc of documents) {
      if (!groups[doc.type]) groups[doc.type] = []
      groups[doc.type]!.push(doc)
    }
    // Sort types by document count descending
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.length - a.length) as [DocumentType, Document[]][]
  }, [documents])

  const toggleFolder = useCallback((type: DocumentType) => {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  return (
    <motion.div
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {grouped.map(([type, docs]) => {
        const isOpen = openFolders.has(type)
        const TypeIcon = getDocumentTypeIcon(type)
        return (
          <motion.div key={type} variants={ITEM_VARIANTS}>
            <button
              type="button"
              onClick={() => toggleFolder(type)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-start transition-all hover:border-primary/30 hover:bg-surface-2"
            >
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                isOpen ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-muted-foreground'
              )}>
                {isOpen ? (
                  <FolderOpen className="h-4 w-4" />
                ) : (
                  <FolderClosed className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {getDocumentTypeLabel(type, locale)}
                  </p>
                  <span className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                    getDocumentTypeColor(type)
                  )}>
                    {docs.length} {t('documents')}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-muted-foreground transition-transform">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 ps-6 pt-1">
                    {docs.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => onView(doc)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors hover:bg-surface-2',
                          !doc.is_current && 'opacity-50'
                        )}
                      >
                        <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="min-w-0 flex-1 truncate text-sm text-foreground">{doc.name}</p>
                        {doc.version_number > 1 && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                            v{doc.version_number}
                          </span>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// --- Bulk Upload Types ---

type BulkFileStatus = 'pending' | 'uploading' | 'analyzing' | 'success' | 'failed'

interface BulkFileEntry {
  file: File
  status: BulkFileStatus
  error: string | null
  insertedDocId: string | null
  analysis: AnalysisResult | null
  resultDoc: Document | null
}

type BulkUploadStep = 'idle' | 'processing' | 'results'

function UploadDialog({
  isOpen,
  onOpenChange,
  locale,
  businessId,
  onDocumentAdded,
  onObligationLinked,
  onRenewalDetected,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  businessId: string | null
  onDocumentAdded: (doc: Document) => void
  onObligationLinked: () => void
  onRenewalDetected: (previousDocId: string) => void
}) {
  const t = useTranslations('vault')
  const tCommon = useTranslations('common')

  const [bulkStep, setBulkStep] = useState<BulkUploadStep>('idle')
  const [fileEntries, setFileEntries] = useState<BulkFileEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleReset = useCallback(() => {
    setBulkStep('idle')
    setFileEntries([])
    setCurrentIndex(0)
  }, [])

  // Process a single file: upload -> analyze -> auto-save with AI results
  const processFile = useCallback(
    async (file: File, index: number): Promise<BulkFileEntry> => {
      const entry: BulkFileEntry = {
        file,
        status: 'uploading',
        error: null,
        insertedDocId: null,
        analysis: null,
        resultDoc: null,
      }

      // Update status to uploading
      setFileEntries((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'uploading' } : e)))

      try {
        if (!businessId) throw new Error('No business ID')

        const supabase = createClient()
        const fileExt = file.name.split('.').pop() ?? 'bin'
        const storagePath = `${businessId}/${Date.now()}-${index}.${fileExt}`

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false })

        if (uploadErr) throw uploadErr

        const SIGNED_URL_EXPIRY_SECONDS = 3600
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(uploadData.path, SIGNED_URL_EXPIRY_SECONDS)

        if (signedUrlError || !signedUrlData?.signedUrl) throw signedUrlError ?? new Error('Failed to generate signed URL')

        const signedUrl = signedUrlData.signedUrl

        const { data: insertedDoc, error: insertError } = (await supabase
          .from('documents')
          .insert({
            business_id: businessId,
            name: file.name,
            file_url: uploadData.path,
            file_size: file.size,
            mime_type: file.type,
            type: 'OTHER',
            is_current: true,
          } as never)
          .select()
          .single()) as unknown as { data: Document | null; error: unknown }

        if (insertError || !insertedDoc) throw insertError ?? new Error('Insert failed')

        entry.insertedDocId = insertedDoc.id

        // Update status to analyzing
        setFileEntries((prev) =>
          prev.map((e, i) => (i === index ? { ...e, status: 'analyzing', insertedDocId: insertedDoc.id } : e))
        )

        // AI analysis (best-effort)
        let analysis: AnalysisResult | null = null
        try {
          const analysisRes = await fetch('/api/analyze-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl: signedUrl, businessId }),
          })

          if (analysisRes.ok) {
            const raw = await analysisRes.json()
            analysis = {
              type: raw.document_type ?? 'OTHER',
              confidence: raw.ai_confidence ?? 0,
              expiryDate: raw.expiry_date ?? null,
              registrationNumber: raw.registration_number ?? null,
            }
          }
        } catch {
          // Analysis is best-effort
        }

        entry.analysis = analysis

        // Auto-save with AI results
        const updatePayload: Record<string, unknown> = {
          type: analysis?.type ?? 'OTHER',
          expiry_date: analysis?.expiryDate ?? null,
          ai_confidence: analysis?.confidence ?? null,
        }

        // Auto-detect renewal
        if (analysis?.registrationNumber && analysis.type !== 'OTHER') {
          const { data: existingDocs } = (await supabase
            .from('documents')
            .select('*')
            .eq('business_id', businessId)
            .eq('type', analysis.type)
            .eq('is_current', true)
            .neq('id', insertedDoc.id)
            .order('version_number', { ascending: false })
            .limit(10)) as unknown as { data: Document[] | null; error: unknown }

          const matchingDoc = existingDocs?.find((d) => {
            const regNum = (d.extracted_data as Record<string, unknown> | null)?.registration_number
            return regNum === analysis!.registrationNumber
          })

          if (matchingDoc) {
            updatePayload.previous_version_id = matchingDoc.id
            updatePayload.version_number = matchingDoc.version_number + 1

            await supabase
              .from('documents')
              .update({ is_current: false } as never)
              .eq('id', matchingDoc.id)
          }
        }

        if (analysis?.registrationNumber) {
          updatePayload.extracted_data = {
            registration_number: analysis.registrationNumber,
          }
        }

        const { data: updatedDoc } = (await supabase
          .from('documents')
          .update(updatePayload as never)
          .eq('id', insertedDoc.id)
          .select()
          .single()) as unknown as { data: Document | null; error: unknown }

        if (updatedDoc) {
          onDocumentAdded(updatedDoc)

          if (updatePayload.previous_version_id) {
            onRenewalDetected(updatePayload.previous_version_id as string)
          }

          const obligationId = await linkDocumentToObligation(supabase, businessId, updatedDoc)
          if (obligationId) onObligationLinked()

          entry.resultDoc = updatedDoc
        }

        entry.status = 'success'
        setFileEntries((prev) =>
          prev.map((e, i) => (i === index ? { ...entry } : e))
        )
        return entry
      } catch (err) {
        const message =
          err instanceof Error ? err.message : locale === 'ar' ? 'فشل رفع الملف' : 'Upload failed'
        entry.status = 'failed'
        entry.error = message
        setFileEntries((prev) =>
          prev.map((e, i) => (i === index ? { ...entry } : e))
        )
        return entry
      }
    },
    [businessId, locale, onDocumentAdded, onObligationLinked, onRenewalDetected]
  )

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length || !businessId) return

      const entries: BulkFileEntry[] = acceptedFiles.map((file) => ({
        file,
        status: 'pending' as BulkFileStatus,
        error: null,
        insertedDocId: null,
        analysis: null,
        resultDoc: null,
      }))

      setFileEntries(entries)
      setBulkStep('processing')
      setCurrentIndex(0)

      // Process sequentially
      for (let i = 0; i < entries.length; i++) {
        setCurrentIndex(i)
        await processFile(entries[i].file, i)
      }

      setBulkStep('results')
    },
    [businessId, processFile]
  )

  const handleRetryFailed = useCallback(async () => {
    setBulkStep('processing')

    const failedIndices = fileEntries
      .map((e, i) => (e.status === 'failed' ? i : -1))
      .filter((i) => i >= 0)

    for (const idx of failedIndices) {
      setCurrentIndex(idx)
      // Reset the entry to pending first
      setFileEntries((prev) =>
        prev.map((e, i) => (i === idx ? { ...e, status: 'pending', error: null } : e))
      )
      await processFile(fileEntries[idx].file, idx)
    }

    setBulkStep('results')
  }, [fileEntries, processFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: true,
    disabled: bulkStep !== 'idle',
  })

  const successCount = fileEntries.filter((e) => e.status === 'success').length
  const failedCount = fileEntries.filter((e) => e.status === 'failed').length
  const totalCount = fileEntries.length

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleReset()
        onOpenChange(open)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl data-[state=open]:animate-scale-in max-h-[85vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold text-foreground">
            {t('uploadDocument')}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {t('uploadDescription')}
          </Dialog.Description>

          <div className="mt-6">
            {/* Idle: drop zone */}
            {bulkStep === 'idle' && (
              <div
                {...getRootProps()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-surface-2'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {tCommon('dragDropHint')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, PNG, JPG, DOC, DOCX — max 25MB
                </p>
                <p className="mt-1 text-xs text-primary">
                  {t('bulkUpload.selectMultiple')}
                </p>
              </div>
            )}

            {/* Processing: show progress */}
            {bulkStep === 'processing' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {t('bulkUpload.processingFiles', {
                      current: Math.min(currentIndex + 1, totalCount),
                      total: totalCount,
                    })}
                  </p>
                  {/* Overall progress bar */}
                  <div className="mt-3 w-full max-w-xs">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                </div>

                {/* File list with status */}
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {fileEntries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 flex-1 truncate text-xs text-foreground">{entry.file.name}</p>
                      <span className="shrink-0">
                        {entry.status === 'pending' && (
                          <span className="text-[10px] text-muted-foreground">{t('bulkUpload.pending')}</span>
                        )}
                        {entry.status === 'uploading' && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        )}
                        {entry.status === 'analyzing' && (
                          <span className="text-[10px] text-primary">{t('bulkUpload.analyzing')}</span>
                        )}
                        {entry.status === 'success' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        {entry.status === 'failed' && (
                          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results: summary */}
            {bulkStep === 'results' && (
              <div className="space-y-4">
                {/* Summary banner */}
                <div className={cn(
                  'flex items-center gap-3 rounded-xl border p-4',
                  failedCount === 0
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-amber-500/20 bg-amber-500/5'
                )}>
                  {failedCount === 0 ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 shrink-0 text-amber-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t('bulkUpload.uploadComplete')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {failedCount === 0
                        ? t('bulkUpload.allSuccessful', { total: totalCount })
                        : t('bulkUpload.resultsSummary', {
                            total: totalCount,
                            success: successCount,
                            failed: failedCount,
                          })}
                    </p>
                  </div>
                </div>

                {/* File list with results */}
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {fileEntries.map((entry, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2',
                        entry.status === 'failed' ? 'bg-red-500/5' : 'bg-surface-2'
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-foreground">{entry.file.name}</p>
                        {entry.status === 'failed' && entry.error && (
                          <p className="truncate text-[10px] text-red-400">{entry.error}</p>
                        )}
                        {entry.status === 'success' && entry.analysis?.type && (
                          <p className="text-[10px] text-muted-foreground">
                            {getDocumentTypeLabel(entry.analysis.type, locale)}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0">
                        {entry.status === 'success' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        {entry.status === 'failed' && (
                          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {failedCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleRetryFailed}
                      className="flex-1 gap-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t('bulkUpload.retryAll')}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      handleReset()
                      onOpenChange(false)
                    }}
                    className="flex-1"
                  >
                    {tCommon('close')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute end-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label={tCommon('close')}
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// --- Page ---

export default function VaultPage() {
  const t = useTranslations('vault')
  const tEmpty = useTranslations('emptyStates')
  const locale = useLocale()

  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const { toasts, showToast, dismissToast } = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<ExpiryStatus | 'ALL'>('ALL')
  const [sortField, setSortField] = useState<SortField>('uploaded_at')
  const [isShowingArchived, setIsShowingArchived] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showObligationLinkedBanner, setShowObligationLinkedBanner] = useState(false)

  /* ─── Load documents ─── */

  useEffect(() => {
    async function loadDocuments() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoading(false)
          return
        }

        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', user.id)
          .single() as { data: { id: string } | null; error: unknown }

        if (!biz) {
          setIsLoading(false)
          return
        }

        setBusinessId(biz.id)

        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('business_id', biz.id)
          .order('uploaded_at', { ascending: false }) as { data: Document[] | null; error: unknown }

        if (docs) setDocuments(docs)
      } catch {
        showToast(locale === 'ar' ? 'فشل في تحميل البيانات' : 'Failed to load data', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    loadDocuments()
  }, [locale, showToast])

  /* ─── Archive document ─── */

  const handleArchive = useCallback(async (doc: Document) => {
    const supabase = createClient()
    const archivedAt = new Date().toISOString()

    const { data } = (await supabase.from('documents')
      .update({ archived_at: archivedAt, is_current: false } as never)
      .eq('id', doc.id)
      .select()
      .single()) as unknown as { data: Document | null; error: unknown }

    if (data) {
      setDocuments((prev) => prev.map((d) => (d.id === data.id ? data : d)))
      setSelectedDoc(null)
    }
  }, [])

  const handleDocumentAdded = useCallback((doc: Document) => {
    setDocuments((prev) => [doc, ...prev])
  }, [])

  const handleObligationLinked = useCallback(() => {
    setShowObligationLinkedBanner(true)
    setTimeout(() => setShowObligationLinkedBanner(false), 5000)
  }, [])

  const handleRenewalDetected = useCallback((previousDocId: string) => {
    // Mark the superseded document as not current in local state
    setDocuments((prev) =>
      prev.map((d) => (d.id === previousDocId ? { ...d, is_current: false } : d))
    )
    showToast(
      locale === 'ar'
        ? 'تم اكتشاف تجديد -- مرتبط بالإصدار السابق'
        : 'Renewal detected -- linked to previous version',
      'success'
    )
  }, [locale, showToast])

  // Counts for status summary
  const statusCounts = useMemo(() => {
    const current = documents.filter((d) => d.archived_at === null)
    return {
      valid: current.filter((d) => getExpiryStatus(d.expiry_date) === 'valid').length,
      expiring: current.filter((d) => getExpiryStatus(d.expiry_date) === 'expiring').length,
      expired: current.filter((d) => getExpiryStatus(d.expiry_date) === 'expired').length,
      expiringSoonTotal: current.filter((d) => {
        if (!d.expiry_date) return false
        const daysLeft = differenceInDays(new Date(d.expiry_date), new Date())
        return daysLeft >= 0 && daysLeft <= 30
      }).length,
    }
  }, [documents])

  // Filtered and sorted documents
  const filteredDocs = useMemo(() => {
    let result = documents

    if (!isShowingArchived) {
      result = result.filter((d) => d.archived_at === null)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          getDocumentTypeLabel(d.type, locale).toLowerCase().includes(q)
      )
    }

    if (typeFilter !== 'ALL') {
      result = result.filter((d) => d.type === typeFilter)
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((d) => getExpiryStatus(d.expiry_date) === statusFilter)
    }

    result.sort((a, b) => {
      switch (sortField) {
        case 'expiry_date':
          return (
            new Date(a.expiry_date ?? '9999').getTime() -
            new Date(b.expiry_date ?? '9999').getTime()
          )
        case 'type':
          return a.type.localeCompare(b.type)
        case 'uploaded_at':
        default:
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      }
    })

    return result
  }, [documents, searchQuery, typeFilter, statusFilter, sortField, isShowingArchived, locale])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-surface-1 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('folder')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'folder'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={t('folderView')}
            >
              <FolderClosed className="h-4 w-4" />
            </button>
          </div>

          <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            {t('uploadDocument')}
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {statusCounts.valid} {t('status.valid')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {statusCounts.expiring} {t('status.expiringSoon')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          {statusCounts.expired} {t('status.expired')}
        </span>
      </div>

      {/* Expiring Soon Banner */}
      <ExpiringSoonBanner
        count={statusCounts.expiringSoonTotal}
        onFilterExpiring={() => {
          setStatusFilter('expiring')
          setSortField('expiry_date')
        }}
      />

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchDocuments')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 ps-9"
          />
        </div>

        <div className="flex gap-2">
          {/* Type Filter */}
          <Select.Root value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocumentType | 'ALL')}>
            <Select.Trigger className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/50">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select.Value>
                {typeFilter === 'ALL' ? t('filterByType') : getDocumentTypeLabel(typeFilter as DocumentType, locale)}
              </Select.Value>
              <Select.Icon>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="z-50 max-h-64 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl" position="popper" sideOffset={4}>
                <Select.Viewport>
                  <Select.Item value="ALL" className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                    <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                    <Select.ItemText>{t('allDocuments')}</Select.ItemText>
                  </Select.Item>
                  {ALL_DOCUMENT_TYPES.map((dtype) => (
                    <Select.Item key={dtype} value={dtype} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                      <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                      <Select.ItemText>{getDocumentTypeLabel(dtype, locale)}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>

          {/* Status Filter */}
          <Select.Root value={statusFilter} onValueChange={(v) => setStatusFilter(v as ExpiryStatus | 'ALL')}>
            <Select.Trigger className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/50">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Select.Value>
                {statusFilter === 'ALL'
                  ? t('filterByStatus')
                  : statusFilter === 'valid'
                    ? t('status.valid')
                    : statusFilter === 'expiring'
                      ? t('status.expiringSoon')
                      : t('status.expired')}
              </Select.Value>
              <Select.Icon>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="z-50 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl" position="popper" sideOffset={4}>
                <Select.Viewport>
                  <Select.Item value="ALL" className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                    <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                    <Select.ItemText>{t('allStatuses')}</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="valid" className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                    <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                    <Select.ItemText>{t('status.valid')}</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="expiring" className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                    <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                    <Select.ItemText>{t('status.expiringSoon')}</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="expired" className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                    <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                    <Select.ItemText>{t('status.expired')}</Select.ItemText>
                  </Select.Item>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>

          {/* Sort */}
          <Select.Root value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <Select.Trigger className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/50">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <Select.Value>{t('sortBy')}</Select.Value>
              <Select.Icon><ChevronDown className="h-3 w-3 text-muted-foreground" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="z-50 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl" position="popper" sideOffset={4}>
                <Select.Viewport>
                  <Select.Item value="uploaded_at" className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                    <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                    <Select.ItemText>{t('sortNewest')}</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="expiry_date" className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                    <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                    <Select.ItemText>Expiry Date</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="type" className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                    <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                    <Select.ItemText>Type</Select.ItemText>
                  </Select.Item>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>

          {/* Show archived toggle */}
          <button
            type="button"
            onClick={() => setIsShowingArchived((prev) => !prev)}
            className={cn(
              'flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
              isShowingArchived
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-surface-1 text-muted-foreground hover:border-primary/50'
            )}
          >
            <Archive className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Archived</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          {filteredDocs.length === 0 ? (
            searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-border bg-card p-12 text-center"
              >
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 font-medium text-foreground">{t('noResults')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('noResultsDescription')}</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-8 py-16 text-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <FolderArchive className="h-16 w-16 text-muted-foreground/50" />
                  </motion.div>
                </div>

                <h3 className="mt-5 text-lg font-semibold text-foreground">{tEmpty('noDocuments')}</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">{tEmpty('noDocumentsDesc')}</p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button onClick={() => setIsUploadOpen(true)}>{tEmpty('uploadFirst')}</Button>
                </div>

                {/* Example document cards preview */}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {['CR', 'GOSI', 'Insurance'].map((label) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs text-muted-foreground"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>{label}</span>
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Expiry tracked</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          ) : viewMode === 'grid' ? (
            <motion.div
              variants={CONTAINER_VARIANTS}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredDocs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  locale={locale}
                  onView={setSelectedDoc}
                />
              ))}
            </motion.div>
          ) : viewMode === 'list' ? (
            <motion.div
              variants={CONTAINER_VARIANTS}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {filteredDocs.map((doc) => (
                <DocumentListRow
                  key={doc.id}
                  doc={doc}
                  locale={locale}
                  onView={setSelectedDoc}
                />
              ))}
            </motion.div>
          ) : (
            <FolderView
              documents={filteredDocs}
              locale={locale}
              onView={setSelectedDoc}
            />
          )}
        </div>

        {/* Detail Panel (desktop only) */}
        <AnimatePresence>
          {selectedDoc && (
            <div className="hidden w-80 shrink-0 lg:block">
              <DocumentDetailPanel
                doc={selectedDoc}
                locale={locale}
                onClose={() => setSelectedDoc(null)}
                onArchive={handleArchive}
                allDocuments={documents}
                onView={setSelectedDoc}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Obligation linked notification */}
      <AnimatePresence>
        {showObligationLinkedBanner && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 end-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 shadow-lg"
          >
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">
              Compliance obligation linked to document
            </p>
            <button
              type="button"
              onClick={() => setShowObligationLinkedBanner(false)}
              className="ms-1 rounded p-0.5 text-emerald-400/70 hover:text-emerald-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        locale={locale}
        businessId={businessId}
        onDocumentAdded={handleDocumentAdded}
        onObligationLinked={handleObligationLinked}
        onRenewalDetected={handleRenewalDetected}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
