import {
  FileText,
  ShieldCheck,
  Building,
  Landmark,
  BadgeCheck,
  Store,
  Briefcase,
  ScrollText,
  CreditCard,
  Receipt,
  FileArchive,
  File,
} from 'lucide-react'
import { differenceInDays } from 'date-fns'

import type { DocumentType } from '@/lib/supabase/types'
import type { LucideIcon } from 'lucide-react'

type ExpiryStatus = 'valid' | 'expiring' | 'expired' | 'none'

const EXPIRY_THRESHOLD_DAYS = 30

function getExpiryStatus(expiryDate: Date | string | null): ExpiryStatus {
  if (!expiryDate) return 'none'

  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate
  const daysUntilExpiry = differenceInDays(expiry, new Date())

  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= EXPIRY_THRESHOLD_DAYS) return 'expiring'
  return 'valid'
}

function getExpiryBadgeColor(status: ExpiryStatus): string {
  switch (status) {
    case 'valid':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    case 'expiring':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'expired':
      return 'bg-red-500/15 text-red-400 border-red-500/20'
    case 'none':
      return 'bg-surface-3 text-muted-foreground border-border'
  }
}

function getExpiryDotColor(status: ExpiryStatus): string {
  switch (status) {
    case 'valid':
      return 'bg-emerald-400'
    case 'expiring':
      return 'bg-amber-400'
    case 'expired':
      return 'bg-red-400'
    case 'none':
      return 'bg-muted-foreground'
  }
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, { en: string; ar: string }> = {
  CR: { en: 'Commercial Registration', ar: 'السجل التجاري' },
  GOSI_CERT: { en: 'GOSI Certificate', ar: 'شهادة التأمينات' },
  ZAKAT_CLEARANCE: { en: 'Zakat Clearance', ar: 'شهادة الزكاة' },
  INSURANCE: { en: 'Insurance', ar: 'التأمين' },
  CHAMBER: { en: 'Chamber of Commerce', ar: 'الغرفة التجارية' },
  BALADY: { en: 'Balady License', ar: 'رخصة بلدي' },
  MISA: { en: 'MISA License', ar: 'ترخيص الاستثمار' },
  LEASE: { en: 'Lease Contract', ar: 'عقد الإيجار' },
  SAUDIZATION_CERT: { en: 'Saudization Certificate', ar: 'شهادة التوطين' },
  BANK_STATEMENT: { en: 'Bank Statement', ar: 'كشف حساب بنكي' },
  TAX_REGISTRATION: { en: 'Tax Registration', ar: 'التسجيل الضريبي' },
  OTHER: { en: 'Other', ar: 'أخرى' },
}

function getDocumentTypeLabel(type: DocumentType, locale: string): string {
  const labels = DOCUMENT_TYPE_LABELS[type]
  return locale === 'ar' ? labels.ar : labels.en
}

const DOCUMENT_TYPE_ICONS: Record<DocumentType, LucideIcon> = {
  CR: FileText,
  GOSI_CERT: ShieldCheck,
  ZAKAT_CLEARANCE: Landmark,
  INSURANCE: BadgeCheck,
  CHAMBER: Building,
  BALADY: Store,
  MISA: Briefcase,
  LEASE: ScrollText,
  SAUDIZATION_CERT: BadgeCheck,
  BANK_STATEMENT: CreditCard,
  TAX_REGISTRATION: Receipt,
  OTHER: File,
}

function getDocumentTypeIcon(type: DocumentType): LucideIcon {
  return DOCUMENT_TYPE_ICONS[type] ?? FileArchive
}

const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  CR: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  GOSI_CERT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  ZAKAT_CLEARANCE: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  INSURANCE: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  CHAMBER: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  BALADY: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  MISA: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  LEASE: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  SAUDIZATION_CERT: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  BANK_STATEMENT: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  TAX_REGISTRATION: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20',
  OTHER: 'bg-surface-3 text-muted-foreground border-border',
}

function getDocumentTypeColor(type: DocumentType): string {
  return DOCUMENT_TYPE_COLORS[type] ?? DOCUMENT_TYPE_COLORS.OTHER
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
}

export {
  getExpiryStatus,
  getExpiryBadgeColor,
  getExpiryDotColor,
  getDocumentTypeLabel,
  getDocumentTypeIcon,
  getDocumentTypeColor,
  formatFileSize,
  DOCUMENT_TYPE_LABELS,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  EXPIRY_THRESHOLD_DAYS,
}

export type { ExpiryStatus }
