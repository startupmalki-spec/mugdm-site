import { differenceInDays } from 'date-fns'
import { getObligationStatus } from '@/lib/compliance/rules-engine'
import { getExpiryStatus } from '@/lib/documents'
import { estimatePenalty } from '@/lib/compliance/penalties'
import type { ObligationType } from '@/lib/supabase/types'

export interface DashboardAlert {
  id: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  icon: string
  title: { en: string; ar: string }
  description: { en: string; ar: string }
  action?: { label: { en: string; ar: string }; href: string }
  module: 'compliance' | 'bookkeeper' | 'vault' | 'team' | 'general'
}

interface AlertInput {
  business: { cr_expiry_date?: string | null; contact_phone?: string | null; contact_email?: string | null }
  documents: { id: string; type: string; expiry_date?: string | null; is_current?: boolean; archived_at?: string | null }[]
  obligations: { id: string; type: string; name: string; next_due_date: string; last_completed_at?: string | null }[]
  transactions: { id: string; is_reviewed?: boolean; ai_confidence?: number | null; date: string }[]
  teamMembers?: { id: string; nationality: string; status: string }[]
}

export function generateDashboardAlerts(data: AlertInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const now = new Date()

  // === CRITICAL ===

  // Overdue obligations
  for (const ob of data.obligations) {
    const status = getObligationStatus(ob.next_due_date, ob.last_completed_at ?? null)
    if (status === 'overdue') {
      const daysLate = differenceInDays(now, new Date(ob.next_due_date))
      const penalty = estimatePenalty(ob.type as ObligationType, daysLate)
      alerts.push({
        id: `overdue-${ob.id}`,
        severity: 'critical',
        icon: 'AlertTriangle',
        title: {
          en: `${ob.name} is ${daysLate} days overdue`,
          ar: `${ob.name} متأخر ${daysLate} يوم`,
        },
        description: {
          en: penalty.amount > 0 ? `Estimated penalty: SAR ${penalty.amount.toLocaleString()}` : 'Complete this obligation immediately to avoid penalties.',
          ar: penalty.amount > 0 ? `الغرامة المقدرة: ${penalty.amount.toLocaleString()} ر.س` : 'أكمل هذا الالتزام فوراً لتجنب الغرامات.',
        },
        action: { label: { en: 'View Calendar', ar: 'عرض التقويم' }, href: '/calendar' },
        module: 'compliance',
      })
    }
  }

  // CR expiry within 30 days
  if (data.business.cr_expiry_date) {
    const daysUntilCR = differenceInDays(new Date(data.business.cr_expiry_date), now)
    if (daysUntilCR >= 0 && daysUntilCR <= 30) {
      alerts.push({
        id: 'cr-expiring',
        severity: 'critical',
        icon: 'FileWarning',
        title: {
          en: `CR expires in ${daysUntilCR} days`,
          ar: `ينتهي السجل التجاري خلال ${daysUntilCR} يوم`,
        },
        description: {
          en: 'Renew your Commercial Registration before it expires.',
          ar: 'جدد سجلك التجاري قبل انتهاء صلاحيته.',
        },
        action: { label: { en: 'View Documents', ar: 'عرض المستندات' }, href: '/vault' },
        module: 'vault',
      })
    }
  }

  // Expired documents
  const currentDocs = data.documents.filter((d) => d.is_current && !d.archived_at)
  for (const doc of currentDocs) {
    if (getExpiryStatus(doc.expiry_date ?? null) === 'expired') {
      alerts.push({
        id: `doc-expired-${doc.id}`,
        severity: 'critical',
        icon: 'FileX',
        title: {
          en: `${doc.type.replace(/_/g, ' ')} document has expired`,
          ar: `مستند ${doc.type.replace(/_/g, ' ')} منتهي الصلاحية`,
        },
        description: {
          en: 'Upload the renewed document to stay compliant.',
          ar: 'ارفع المستند المجدد للبقاء ملتزماً.',
        },
        action: { label: { en: 'Upload', ar: 'رفع' }, href: '/vault' },
        module: 'vault',
      })
    }
  }

  // === WARNING ===

  // Obligations due within 15 days
  for (const ob of data.obligations) {
    const status = getObligationStatus(ob.next_due_date, ob.last_completed_at ?? null)
    if (status === 'upcoming') {
      const daysUntil = differenceInDays(new Date(ob.next_due_date), now)
      if (daysUntil <= 15) {
        alerts.push({
          id: `due-soon-${ob.id}`,
          severity: 'warning',
          icon: 'Clock',
          title: {
            en: `${ob.name} due in ${daysUntil} days`,
            ar: `${ob.name} مستحق خلال ${daysUntil} يوم`,
          },
          description: {
            en: `Due date: ${ob.next_due_date}`,
            ar: `تاريخ الاستحقاق: ${ob.next_due_date}`,
          },
          action: { label: { en: 'View', ar: 'عرض' }, href: '/calendar' },
          module: 'compliance',
        })
      }
    }
  }

  // Documents expiring within 30 days
  for (const doc of currentDocs) {
    if (getExpiryStatus(doc.expiry_date ?? null) === 'expiring') {
      alerts.push({
        id: `doc-expiring-${doc.id}`,
        severity: 'warning',
        icon: 'FileWarning',
        title: {
          en: `${doc.type.replace(/_/g, ' ')} expires soon`,
          ar: `${doc.type.replace(/_/g, ' ')} ينتهي قريباً`,
        },
        description: {
          en: `Expires: ${doc.expiry_date}`,
          ar: `ينتهي: ${doc.expiry_date}`,
        },
        action: { label: { en: 'View', ar: 'عرض' }, href: '/vault' },
        module: 'vault',
      })
    }
  }

  // Unreviewed transactions
  const unreviewedCount = data.transactions.filter(
    (tx) => tx.is_reviewed === false && tx.ai_confidence !== null && tx.ai_confidence !== undefined && tx.ai_confidence < 0.7
  ).length
  if (unreviewedCount > 0) {
    alerts.push({
      id: 'unreviewed-tx',
      severity: 'warning',
      icon: 'ListChecks',
      title: {
        en: `${unreviewedCount} transactions need review`,
        ar: `${unreviewedCount} عمليات تحتاج مراجعة`,
      },
      description: {
        en: 'Low-confidence AI extractions need manual verification.',
        ar: 'تحتاج الاستخراجات منخفضة الثقة إلى تحقق يدوي.',
      },
      action: { label: { en: 'Review', ar: 'مراجعة' }, href: '/bookkeeper' },
      module: 'bookkeeper',
    })
  }

  // Saudization below 40%
  if (data.teamMembers && data.teamMembers.length > 0) {
    const active = data.teamMembers.filter((m) => m.status === 'ACTIVE')
    if (active.length > 0) {
      const saudiCount = active.filter((m) => m.nationality?.toLowerCase() === 'saudi').length
      const saudiPct = (saudiCount / active.length) * 100
      if (saudiPct < 40) {
        alerts.push({
          id: 'saudization-low',
          severity: 'warning',
          icon: 'Users',
          title: {
            en: `Saudization at ${Math.round(saudiPct)}%`,
            ar: `نسبة السعودة ${Math.round(saudiPct)}%`,
          },
          description: {
            en: 'Below recommended 40% threshold. Consider hiring Saudi nationals.',
            ar: 'أقل من الحد الموصى به 40%. فكر في توظيف مواطنين سعوديين.',
          },
          action: { label: { en: 'View Team', ar: 'عرض الفريق' }, href: '/team' },
          module: 'team',
        })
      }
    }
  }

  // === INFO ===

  // No transactions in 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
  const recentTx = data.transactions.filter((tx) => tx.date >= thirtyDaysAgo)
  if (recentTx.length === 0 && data.transactions.length > 0) {
    alerts.push({
      id: 'no-recent-tx',
      severity: 'info',
      icon: 'FileUp',
      title: {
        en: 'No transactions in the last 30 days',
        ar: 'لا توجد عمليات في آخر 30 يوماً',
      },
      description: {
        en: 'Import your latest bank statement to keep your books up to date.',
        ar: 'استورد كشف حسابك البنكي الأخير لتحديث دفاترك.',
      },
      action: { label: { en: 'Import', ar: 'استيراد' }, href: '/bookkeeper' },
      module: 'bookkeeper',
    })
  }

  // Profile incomplete
  if (!data.business.contact_phone || !data.business.contact_email) {
    alerts.push({
      id: 'profile-incomplete',
      severity: 'info',
      icon: 'UserCircle',
      title: {
        en: 'Business profile incomplete',
        ar: 'الملف التجاري غير مكتمل',
      },
      description: {
        en: 'Add contact phone and email for compliance notifications.',
        ar: 'أضف رقم الهاتف والبريد الإلكتروني لإشعارات الامتثال.',
      },
      action: { label: { en: 'Complete Profile', ar: 'أكمل الملف' }, href: '/profile' },
      module: 'general',
    })
  }

  // === SUCCESS (only if zero critical + zero warning) ===
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount = alerts.filter((a) => a.severity === 'warning').length
  if (criticalCount === 0 && warningCount === 0) {
    alerts.push({
      id: 'all-clear',
      severity: 'success',
      icon: 'CheckCircle2',
      title: {
        en: 'All compliance obligations on track',
        ar: 'جميع الالتزامات على المسار الصحيح',
      },
      description: {
        en: 'No urgent items need your attention.',
        ar: 'لا توجد عناصر عاجلة تحتاج انتباهك.',
      },
      module: 'general',
    })
  }

  // Sort: critical → warning → info → success
  const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return alerts
}
