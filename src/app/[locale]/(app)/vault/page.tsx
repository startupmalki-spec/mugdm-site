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
  Check,
  Loader2,
  AlertTriangle,
  Eye,
  Archive,
  Clock,
  Filter,
  ArrowUpDown,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
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

type ViewMode = 'grid' | 'list'
type SortField = 'uploaded_at' | 'expiry_date' | 'type'
type UploadStep = 'idle' | 'uploading' | 'analyzing' | 'confirm'

interface AnalysisResult {
  type: DocumentType
  confidence: number
  expiryDate: string | null
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
  const Icon = getDocumentTypeIcon(doc.type)
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
          <Icon className="h-5 w-5" />
        </div>
        {status !== 'none' && <StatusBadge status={status} label={statusLabel} />}
      </div>

      <p className="mt-3 line-clamp-2 text-sm font-medium text-foreground">{doc.name}</p>

      <div className="mt-2">
        <TypeBadge type={doc.type} locale={locale} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{format(new Date(doc.uploaded_at), 'dd MMM yyyy', { locale: dateLocale })}</span>
        {daysLeft !== null && daysLeft >= 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {daysLeft}d
          </span>
        )}
      </div>

      {formatFileSize(doc.file_size) !== '--' && (
        <span className="mt-1 text-xs text-muted-foreground">
          {formatFileSize(doc.file_size)}
        </span>
      )}
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
  const Icon = getDocumentTypeIcon(doc.type)
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
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
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
        {doc.expiry_date && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(doc.expiry_date), 'dd MMM yyyy', { locale: dateLocale })}
          </span>
        )}
      </div>

      <div className="shrink-0">
        {status !== 'none' && <StatusBadge status={status} label={statusLabel} />}
      </div>
    </motion.button>
  )
}

function DocumentDetailPanel({
  doc,
  locale,
  onClose,
  onArchive,
}: {
  doc: Document
  locale: string
  onClose: () => void
  onArchive: (doc: Document) => void
}) {
  const t = useTranslations('vault')
  const Icon = getDocumentTypeIcon(doc.type)
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
            <Icon className="h-6 w-6" />
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
    </motion.div>
  )
}

function UploadDialog({
  isOpen,
  onOpenChange,
  locale,
  businessId,
  onDocumentAdded,
  onObligationLinked,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  businessId: string | null
  onDocumentAdded: (doc: Document) => void
  onObligationLinked: () => void
}) {
  const t = useTranslations('vault')
  const tCommon = useTranslations('common')

  const [uploadStep, setUploadStep] = useState<UploadStep>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [selectedType, setSelectedType] = useState<DocumentType>('OTHER')
  const [expiryDate, setExpiryDate] = useState('')
  const [insertedDocId, setInsertedDocId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleReset = useCallback(() => {
    setUploadStep('idle')
    setSelectedFile(null)
    setAnalysis(null)
    setSelectedType('OTHER')
    setExpiryDate('')
    setInsertedDocId(null)
    setIsSaving(false)
  }, [])

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file || !businessId) return

      setSelectedFile(file)
      setUploadStep('uploading')

      try {
        const supabase = createClient()
        const fileExt = file.name.split('.').pop() ?? 'bin'
        const storagePath = `${businessId}/${Date.now()}.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(uploadData.path)

        const { data: insertedDoc, error: insertError } = await (supabase
          .from('documents') as any)
          .insert({
            business_id: businessId,
            name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            mime_type: file.type,
            type: 'OTHER',
            is_current: true,
          })
          .select()
          .single() as { data: Document | null; error: unknown }

        if (insertError || !insertedDoc) throw insertError ?? new Error('Insert failed')

        setInsertedDocId(insertedDoc.id)
        setUploadStep('analyzing')

        try {
          const analysisRes = await fetch('/api/analyze-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl: publicUrl, businessId }),
          })

          if (analysisRes.ok) {
            const raw = await analysisRes.json()
            const result: AnalysisResult = {
              type: raw.document_type ?? 'OTHER',
              confidence: raw.ai_confidence ?? 0,
              expiryDate: raw.expiry_date ?? null,
            }
            setAnalysis(result)
            setSelectedType(result.type)
            if (result.expiryDate) setExpiryDate(result.expiryDate)
          }
        } catch {
          // Analysis is best-effort; proceed to confirm step regardless
        }

        setUploadStep('confirm')
      } catch {
        setUploadStep('idle')
      }
    },
    [businessId]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: false,
    disabled: uploadStep !== 'idle',
  })

  const handleSave = useCallback(async () => {
    if (!selectedFile || !businessId || !insertedDocId) return

    setIsSaving(true)

    try {
      const supabase = createClient()

      const updatePayload: Record<string, unknown> = {
        type: selectedType,
        expiry_date: expiryDate || null,
        ai_confidence: analysis?.confidence ?? null,
      }

      const { data: updatedDoc } = await (supabase
        .from('documents') as any)
        .update(updatePayload)
        .eq('id', insertedDocId)
        .select()
        .single() as { data: Document | null; error: unknown }

      if (updatedDoc) {
        onDocumentAdded(updatedDoc)
        const obligationId = await linkDocumentToObligation(supabase, businessId, updatedDoc)
        if (obligationId) onObligationLinked()
      }
    } finally {
      handleReset()
      onOpenChange(false)
    }
  }, [selectedFile, selectedType, expiryDate, analysis, businessId, insertedDocId, onDocumentAdded, onObligationLinked, onOpenChange, handleReset])

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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl data-[state=open]:animate-scale-in">
          <Dialog.Title className="text-lg font-semibold text-foreground">
            {t('uploadDocument')}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {t('uploadDescription')}
          </Dialog.Description>

          <div className="mt-6">
            {uploadStep === 'idle' && (
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
              </div>
            )}

            {(uploadStep === 'uploading' || uploadStep === 'analyzing') && (
              <div className="flex flex-col items-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium text-foreground">
                  {uploadStep === 'uploading' ? tCommon('loading') : 'Analyzing document...'}
                </p>
                {selectedFile && (
                  <p className="mt-1 text-xs text-muted-foreground">{selectedFile.name}</p>
                )}
              </div>
            )}

            {uploadStep === 'confirm' && (
              <div className="space-y-4">
                {selectedFile && (
                  <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                )}

                {analysis && analysis.confidence > 0.5 && (
                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs text-foreground">
                      We think this is a{' '}
                      <strong>{getDocumentTypeLabel(analysis.type, locale)}</strong>
                      {' '}({Math.round(analysis.confidence * 100)}% confidence). Is that right?
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Document Type
                  </label>
                  <Select.Root value={selectedType} onValueChange={(v) => setSelectedType(v as DocumentType)}>
                    <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring">
                      <Select.Value>
                        {getDocumentTypeLabel(selectedType, locale)}
                      </Select.Value>
                      <Select.Icon>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        className="z-[60] max-h-64 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl"
                        position="popper"
                        sideOffset={4}
                      >
                        <Select.Viewport>
                          {ALL_DOCUMENT_TYPES.map((dtype) => (
                            <Select.Item
                              key={dtype}
                              value={dtype}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2"
                            >
                              <Select.ItemIndicator>
                                <Check className="h-4 w-4 text-primary" />
                              </Select.ItemIndicator>
                              <Select.ItemText>
                                {getDocumentTypeLabel(dtype, locale)}
                              </Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Expiry Date
                  </label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleReset()
                      onOpenChange(false)
                    }}
                    className="flex-1"
                    disabled={isSaving}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button onClick={handleSave} className="flex-1 gap-2" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {tCommon('save')}
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
  const tCommon = useTranslations('common')
  const tEmpty = useTranslations('emptyStates')
  const locale = useLocale()

  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [businessId, setBusinessId] = useState<string | null>(null)
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
      setIsLoading(false)
    }

    loadDocuments()
  }, [])

  /* ─── Archive document ─── */

  const handleArchive = useCallback(async (doc: Document) => {
    const supabase = createClient()
    const archivedAt = new Date().toISOString()

    const { data } = await (supabase.from('documents') as any)
      .update({ archived_at: archivedAt, is_current: false })
      .eq('id', doc.id)
      .select()
      .single() as { data: Document | null; error: unknown }

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

  // Counts for status summary
  const statusCounts = useMemo(() => {
    const current = documents.filter((d) => d.archived_at === null)
    return {
      valid: current.filter((d) => getExpiryStatus(d.expiry_date) === 'valid').length,
      expiring: current.filter((d) => getExpiryStatus(d.expiry_date) === 'expiring').length,
      expired: current.filter((d) => getExpiryStatus(d.expiry_date) === 'expired').length,
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title={tEmpty('noDocuments')}
                description={tEmpty('noDocumentsDesc')}
                actionLabel={tEmpty('uploadFirst')}
                onAction={() => setIsUploadOpen(true)}
              />
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
          ) : (
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
      />
    </div>
  )
}
