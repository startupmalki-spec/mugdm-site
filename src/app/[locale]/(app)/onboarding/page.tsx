'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Building2,
  Phone,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  CalendarDays,
  Clock,
  CalendarCheck,
} from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/upload/FileUpload'
import { isValidCRNumber } from '@/lib/validations'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  generateObligationsFromCR,
  type GeneratedObligation,
  type CRData,
} from '@/lib/compliance/obligation-generator'
import type { ObligationType } from '@/lib/supabase/types'
import {
  ObligationReview,
  type PreviewedObligation,
} from '@/components/onboarding/ObligationReview'

/* ───────── Types ───────── */

interface Owner {
  name: string
  nationality: string
  share: number
}

interface WizardData {
  crDocumentUrl: string | null
  nameAr: string
  nameEn: string
  crNumber: string
  activityType: string
  city: string
  capital: string
  crIssuanceDate: string
  crExpiryDate: string
  owners: Owner[]
  logoUrl: string | null
  stampUrl: string | null
  phone: string
  email: string
  address: string
}

/* ───────── Constants ───────── */

// Steps: 1=Upload CR, 2=Reveal Animation, 3=Confirm Profile, 4=Calendar Preview, 5=Contact Info
const TOTAL_STEPS = 5

// Visual step indicators only show the 3 main steps (upload, profile, contact)
const VISUAL_STEPS = 3
const STEP_ICONS = [Upload, Building2, Phone] as const

function getVisualStep(step: number): number {
  if (step <= 2) return 1 // Upload + Reveal
  if (step <= 3) return 2 // Confirm profile
  return 3 // Calendar preview + Contact
}

const OBLIGATION_ICONS: Record<string, typeof CalendarDays> = {
  CR_CONFIRMATION: Building2,
  GOSI: CalendarDays,
  ZATCA_VAT: CalendarDays,
  ZAKAT: CalendarDays,
  CHAMBER: Building2,
  BALADY: Building2,
  FOOD_SAFETY: CalendarDays,
  SAFETY_CERT: CalendarDays,
  HEALTH_LICENSE: CalendarDays,
}

const OBLIGATION_COLORS: Record<string, string> = {
  CR_CONFIRMATION: 'text-blue-400 bg-blue-500/10',
  GOSI: 'text-emerald-400 bg-emerald-500/10',
  ZATCA_VAT: 'text-amber-400 bg-amber-500/10',
  ZAKAT: 'text-purple-400 bg-purple-500/10',
  CHAMBER: 'text-cyan-400 bg-cyan-500/10',
  BALADY: 'text-orange-400 bg-orange-500/10',
  FOOD_SAFETY: 'text-red-400 bg-red-500/10',
  SAFETY_CERT: 'text-yellow-400 bg-yellow-500/10',
  HEALTH_LICENSE: 'text-pink-400 bg-pink-500/10',
}

const INITIAL_OWNER: Owner = { name: '', nationality: '', share: 100 }

const INITIAL_DATA: WizardData = {
  crDocumentUrl: null,
  nameAr: '',
  nameEn: '',
  crNumber: '',
  activityType: '',
  city: '',
  capital: '',
  crIssuanceDate: '',
  crExpiryDate: '',
  owners: [{ ...INITIAL_OWNER }],
  logoUrl: null,
  stampUrl: null,
  phone: '',
  email: '',
  address: '',
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
}

/* ───────── Component ───────── */

export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const tProfile = useTranslations('profile')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [data, setData] = useState<WizardData>(INITIAL_DATA)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzingMessage, setAnalyzingMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [revealDone, setRevealDone] = useState(false)
  const [generatedObligations, setGeneratedObligations] = useState<GeneratedObligation[]>([])
  const [wathqCrInput, setWathqCrInput] = useState('')
  const [wathqBusy, setWathqBusy] = useState(false)
  const [wathqError, setWathqError] = useState<string | null>(null)
  const [showUploadFallback, setShowUploadFallback] = useState(false)
  const [crSource, setCrSource] = useState<'manual' | 'wathq_api' | 'document_ocr' | 'qr_webpage'>('manual')
  const [crStoragePath, setCrStoragePath] = useState<string | null>(null)
  const [mainActivityCode, setMainActivityCode] = useState<string | null>(null)
  const [subActivities, setSubActivities] = useState<string[]>([])
  const [hasPhysicalLocation, setHasPhysicalLocation] = useState<boolean | null>(null)
  const [previewObligations, setPreviewObligations] = useState<PreviewedObligation[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmedTypes, setConfirmedTypes] = useState<Set<ObligationType>>(new Set())

  /* ─── Draft persistence via sessionStorage ─── */
  const DRAFT_KEY = 'mugdm-onboarding-draft'

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as {
        data: WizardData
        step: number
        crSource: string
        mainActivityCode: string | null
        subActivities: string[]
        hasPhysicalLocation: boolean | null
        confirmedTypes: string[]
        savedAt: number
      }
      // Discard drafts older than 24 hours
      if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        sessionStorage.removeItem(DRAFT_KEY)
        return
      }
      setData(draft.data)
      setStep(draft.step)
      setCrSource(draft.crSource as typeof crSource)
      setMainActivityCode(draft.mainActivityCode)
      setSubActivities(draft.subActivities)
      setHasPhysicalLocation(draft.hasPhysicalLocation)
      setConfirmedTypes(new Set(draft.confirmedTypes as ObligationType[]))
    } catch {
      sessionStorage.removeItem(DRAFT_KEY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save draft on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            data,
            step,
            crSource,
            mainActivityCode,
            subActivities,
            hasPhysicalLocation,
            confirmedTypes: Array.from(confirmedTypes),
            savedAt: Date.now(),
          })
        )
      } catch { /* quota exceeded — ignore */ }
    }, 500)
    return () => clearTimeout(timer)
  }, [data, step, crSource, mainActivityCode, subActivities, hasPhysicalLocation, confirmedTypes])

  /* ─── Generate obligations when profile data changes ─── */
  const obligations = useMemo(() => {
    if (!data.crNumber) return []
    const crData: CRData = {
      crNumber: data.crNumber,
      businessName: data.nameAr,
      activityType: data.activityType || null,
      expiryDate: data.crExpiryDate || null,
      city: data.city || null,
    }
    return generateObligationsFromCR(crData)
  }, [data.crNumber, data.nameAr, data.activityType, data.crExpiryDate, data.city])

  useEffect(() => {
    if (obligations.length > 0) {
      setGeneratedObligations(obligations)
    }
  }, [obligations])

  /* ─── Fetch obligation preview when entering review step ─── */
  useEffect(() => {
    if (step !== 4) return
    let cancelled = false
    setPreviewLoading(true)
    ;(async () => {
      try {
        const res = await fetch('/api/compliance/preview-obligations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cr_number: data.crNumber,
            business_name: data.nameAr,
            activity_type: data.activityType || null,
            cr_expiry_date: data.crExpiryDate || null,
            city: data.city || null,
            main_activity_code: mainActivityCode,
            sub_activities: subActivities,
            has_physical_location: hasPhysicalLocation,
            capital: data.capital ? Number(data.capital) : null,
          }),
        })
        if (!res.ok) throw new Error('preview failed')
        const json = (await res.json()) as { obligations: PreviewedObligation[] }
        if (cancelled) return
        setPreviewObligations(json.obligations)
        // Default-checked: REQUIRED (locked) + SUGGESTED items. BALADY defaults
        // OFF when the user said they have no physical premises. NOT_APPLICABLE
        // items are never added.
        const preChecked = new Set<ObligationType>()
        for (const ob of json.obligations) {
          if (ob.applicability === 'NOT_APPLICABLE') continue
          if (ob.applicability === 'REQUIRED') {
            preChecked.add(ob.type)
            continue
          }
          // SUGGESTED — on by default, except BALADY with no premises.
          if (ob.type === 'BALADY' && hasPhysicalLocation === false) continue
          preChecked.add(ob.type)
        }
        setConfirmedTypes(preChecked)
      } catch {
        if (cancelled) return
        setPreviewObligations([])
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, data.crNumber, data.nameAr, data.activityType, data.crExpiryDate, data.city, data.capital, mainActivityCode, subActivities, hasPhysicalLocation])

  /* ─── Reveal auto-advance timers ─── */
  useEffect(() => {
    if (step !== 2) return
    setRevealDone(false)
    const timer = setTimeout(() => {
      setRevealDone(true)
    }, 4500)
    return () => clearTimeout(timer)
  }, [step])

  useEffect(() => {
    if (revealDone && step === 2) {
      const timer = setTimeout(() => {
        setDirection(1)
        setStep(3)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [revealDone, step])

  const handleRevealContinue = useCallback(() => {
    if (step === 2) {
      setDirection(1)
      setStep(3)
    }
  }, [step])

  /* ─── Navigation ─── */

  const handleNext = useCallback(async () => {
    // Step 3 = Confirm Profile — validate before advancing
    if (step === 3) {
      const newErrors: Record<string, string> = {}
      if (!data.nameAr.trim()) newErrors.nameAr = tCommon('required')
      if (!data.crNumber.trim()) newErrors.crNumber = tCommon('required')
      else if (!isValidCRNumber(data.crNumber))
        newErrors.crNumber = tProfile('crNumberPlaceholder')
      if (!data.activityType.trim()) newErrors.activityType = tCommon('required')
      if (!data.city.trim()) newErrors.city = tCommon('required')

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        return
      }

      // Check CR number uniqueness before advancing
      const supabase = createClient()
      const { data: existing } = (await supabase
        .from('businesses')
        .select('id')
        .eq('cr_number', data.crNumber)
        .maybeSingle()) as unknown as { data: { id: string } | null }

      if (existing) {
        setErrors({
          crNumber: t('crAlreadyRegistered'),
        })
        return
      }

      setErrors({})
    }

    setDirection(1)
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS))
  }, [step, data, t, tCommon, tProfile])

  const handleBack = useCallback(() => {
    setDirection(-1)
    // Skip reveal (step 2) and calendar preview (step 4) when going back
    setStep((prev) => {
      if (prev === 3) return 1 // From profile -> skip reveal -> upload
      if (prev === 5) return 3 // From contact -> skip calendar -> profile
      return Math.max(prev - 1, 1)
    })
  }, [])

  /* ─── Wathq Lookup (preferred path) ─── */

  const handleWathqLookup = useCallback(async () => {
    setWathqError(null)
    const cr = wathqCrInput.replace(/\D/g, '').slice(0, 10)
    if (!isValidCRNumber(cr)) {
      setWathqError(tProfile('crNumberPlaceholder'))
      return
    }
    setWathqBusy(true)
    try {
      const res = await fetch('/api/wathq/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cr_number: cr }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        code?: string
        wizard?: Partial<WizardData> & { owners?: Owner[] }
        data?: {
          main_activity_code?: string | null
          sub_activities?: string[]
        }
      }
      if (!res.ok || !json.ok || !json.wizard) {
        if (json.code === 'SUBSCRIPTION_DENIED') {
          setWathqError(t('wathqSubscriptionDenied'))
          setShowUploadFallback(true)
          return
        }
        setWathqError(t('wathqLookupFailed'))
        return
      }
      const w = json.wizard
      setData((prev) => ({
        ...prev,
        nameAr: w.nameAr ?? prev.nameAr,
        nameEn: w.nameEn ?? prev.nameEn,
        crNumber: w.crNumber ?? cr,
        activityType: w.activityType ?? prev.activityType,
        city: w.city ?? prev.city,
        capital: w.capital ?? prev.capital,
        crIssuanceDate: w.crIssuanceDate ?? prev.crIssuanceDate,
        crExpiryDate: w.crExpiryDate ?? prev.crExpiryDate,
        owners:
          Array.isArray(w.owners) && w.owners.length > 0 ? w.owners : prev.owners,
      }))
      setCrSource('wathq_api')
      if (json.data?.main_activity_code) setMainActivityCode(json.data.main_activity_code)
      if (Array.isArray(json.data?.sub_activities)) setSubActivities(json.data!.sub_activities!)
      // Jump straight to the reveal animation (Step 2). Step 3 will be
      // entered automatically by the existing reveal auto-advance timer.
      setDirection(1)
      setStep(2)
    } catch {
      setWathqError(t('wathqLookupFailed'))
    } finally {
      setWathqBusy(false)
    }
  }, [wathqCrInput, t, tCommon, tProfile])

  /* ─── CR Upload Handler ─── */

  const handleCRUpload = useCallback(
    async (url: string, _file: File, storagePath?: string) => {
      setData((prev) => ({ ...prev, crDocumentUrl: url }))
      if (storagePath) setCrStoragePath(storagePath)
      setIsAnalyzing(true)
      setAnalyzingMessage(t('crAgentReading'))
      setDirection(1)

      // Show progressive status messages while waiting
      const statusTimer = setTimeout(() => {
        setAnalyzingMessage(t('crAgentVerifying'))
      }, 4000)
      const statusTimer2 = setTimeout(() => {
        setAnalyzingMessage(t('crAgentExtracting'))
      }, 8000)

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // Detect media type from URL extension
        const urlMediaType = /\.pdf(\?|$)/i.test(url) ? 'application/pdf'
          : /\.png(\?|$)/i.test(url) ? 'image/png'
          : /\.jpe?g(\?|$)/i.test(url) ? 'image/jpeg'
          : 'image/jpeg'

        const res = await fetch('/api/analyze-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: url,
            mediaType: urlMediaType,
            businessId: user?.id ?? 'onboarding',
            useCRAgent: true,
          }),
        })

        if (res.ok) {
          const result = await res.json()
          const extra = result.additional_data ?? {}

          // Update status based on agent source
          if (extra.cr_agent_source === 'qr_webpage') {
            setAnalyzingMessage(t('crAgentVerified'))
          }
          if (
            extra.cr_agent_source === 'wathq_api' ||
            extra.cr_agent_source === 'qr_webpage' ||
            extra.cr_agent_source === 'document_ocr'
          ) {
            setCrSource(extra.cr_agent_source)
          }

          // Map ALL returned fields to form data
          const owners: Owner[] = Array.isArray(extra.owners) && extra.owners.length > 0
            ? extra.owners.map((o: { name?: string; id_number?: string; share?: number; nationality?: string }) => ({
                name: o.name ?? '',
                nationality: o.nationality ?? '',
                share: typeof o.share === 'number' ? o.share : 0,
              }))
            : [{ ...INITIAL_OWNER }]

          if (extra.main_activity_code) setMainActivityCode(extra.main_activity_code)
          if (Array.isArray(extra.sub_activities)) setSubActivities(extra.sub_activities)

          setData((prev) => ({
            ...prev,
            nameAr: extra.name_ar ?? result.holder_name ?? prev.nameAr,
            nameEn: extra.name_en ?? prev.nameEn,
            crNumber: extra.cr_number ?? result.registration_number ?? prev.crNumber,
            crExpiryDate: result.expiry_date ?? prev.crExpiryDate,
            crIssuanceDate: extra.issue_date ?? prev.crIssuanceDate,
            activityType: extra.activity_type ?? prev.activityType,
            city: extra.city ?? prev.city,
            capital: extra.capital ? String(extra.capital) : prev.capital,
            owners,
          }))
        }
      } catch {
        // AI extraction failed — user can fill fields manually
      } finally {
        clearTimeout(statusTimer)
        clearTimeout(statusTimer2)
        setIsAnalyzing(false)
        setAnalyzingMessage('')
        setStep(2)
      }
    },
    [t]
  )

  /* ─── Owner Management ─── */

  const handleAddOwner = useCallback(() => {
    setData((prev) => ({
      ...prev,
      owners: [...prev.owners, { name: '', nationality: '', share: 0 }],
    }))
  }, [])

  const handleRemoveOwner = useCallback((index: number) => {
    setData((prev) => ({
      ...prev,
      owners: prev.owners.filter((_, i) => i !== index),
    }))
  }, [])

  const handleOwnerChange = useCallback(
    (index: number, field: keyof Owner, value: string | number) => {
      setData((prev) => ({
        ...prev,
        owners: prev.owners.map((owner, i) =>
          i === index ? { ...owner, [field]: value } : owner
        ),
      }))
    },
    []
  )

  /* ─── Field Updates ─── */

  const handleFieldChange = useCallback(
    (field: keyof WizardData, value: string) => {
      setData((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    []
  )

  /* ─── Submit ─── */

  const handleComplete = useCallback(async () => {
    setIsSubmitting(true)

    try {
      const payload = {
        name_ar: data.nameAr,
        name_en: data.nameEn || undefined,
        cr_number: data.crNumber,
        activity_type: data.activityType || undefined,
        city: data.city || undefined,
        capital: data.capital ? Number(data.capital) : undefined,
        cr_issuance_date: data.crIssuanceDate || undefined,
        cr_expiry_date: data.crExpiryDate || undefined,
        owners: data.owners.filter((o) => o.name.trim()),
        logo_url: data.logoUrl || undefined,
        stamp_url: data.stampUrl || undefined,
        contact_phone: data.phone || undefined,
        contact_email: data.email || undefined,
        contact_address: data.address || undefined,
        cr_document_url: crStoragePath || data.crDocumentUrl || undefined,
        cr_source: crSource,
        main_activity_code: mainActivityCode,
        sub_activities: subActivities,
        has_physical_location: hasPhysicalLocation,
        confirmed_obligation_types: Array.from(confirmedTypes),
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to create business')
      }

      // Mark CR upload as done in the getting-started checklist
      try {
        const checklist = JSON.parse(localStorage.getItem('mugdm-getting-started') || '{}')
        checklist.uploadCR = true
        checklist.showChecklist = true
        localStorage.setItem('mugdm-getting-started', JSON.stringify(checklist))
      } catch {
        // localStorage not available
      }

      sessionStorage.removeItem(DRAFT_KEY)
      router.push('/dashboard')
    } catch {
      setErrors({ submit: tCommon('error') })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    data,
    router,
    tCommon,
    crSource,
    mainActivityCode,
    subActivities,
    hasPhysicalLocation,
    confirmedTypes,
    crStoragePath,
  ])

  /* ─── Step 1: Upload CR ─── */

  function renderStep1() {
    if (isAnalyzing) {
      return (
        <motion.div
          key="analyzing"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 py-12"
        >
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 p-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <motion.div
              className="absolute -inset-2 rounded-2xl border-2 border-primary/20"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              {t('processing')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {analyzingMessage || t('processingDescription')}
            </p>
          </div>
        </motion.div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {showUploadFallback ? t('step1Title') : t('wathqEntryTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {showUploadFallback ? t('step1Description') : t('wathqEntryDescription')}
          </p>
        </div>

        {!showUploadFallback && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('crNumber')}
              </label>
              <Input
                value={wathqCrInput}
                onChange={(e) => {
                  setWathqError(null)
                  setWathqCrInput(e.target.value.replace(/\D/g, '').slice(0, 10))
                }}
                placeholder={tProfile('crNumberPlaceholder')}
                dir="ltr"
                inputMode="numeric"
                error={wathqError ?? undefined}
                disabled={wathqBusy}
              />
            </div>
            <Button
              onClick={handleWathqLookup}
              disabled={wathqBusy || !isValidCRNumber(wathqCrInput)}
              size="lg"
              className="w-full gap-2"
            >
              {wathqBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('wathqLookingUp')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('wathqLookupButton')}
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={() => {
                setWathqError(null)
                setShowUploadFallback(true)
              }}
              className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t('wathqOrUpload')}
            </button>
          </div>
        )}

        {showUploadFallback && (
        <>
        <FileUpload
          accept={{
            'application/pdf': ['.pdf'],
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
          }}
          maxSize={10 * 1024 * 1024}
          bucket="documents"
          path="cr"
          onUpload={handleCRUpload}
          label={t('uploadCR')}
          description={t('uploadCRDescription')}
          previewUrl={data.crDocumentUrl}
          uploadViaApi
        />

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleNext}
            disabled={!data.crDocumentUrl}
            size="lg"
            className="gap-2"
          >
            {tCommon('next')}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
        </>
        )}
      </div>
    )
  }

  /* ─── Step 2: Reveal Animation ─── */

  function renderRevealStep() {
    const fields = [
      { key: 'businessName', label: t('revealBusinessName'), value: data.nameAr },
      { key: 'crNumber', label: t('revealCrNumber'), value: data.crNumber },
      { key: 'expiryDate', label: t('revealExpiryDate'), value: data.crExpiryDate },
      { key: 'activityType', label: t('revealActivityType'), value: data.activityType },
    ].filter((f) => f.value)

    const allFound = fields.length === 4

    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {t('revealTitle')}
          </h2>
        </motion.div>

        <div className="w-full max-w-sm space-y-3">
          {fields.map((field, index) => (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.4, duration: 0.4, ease: 'easeOut' }}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <span className="text-sm text-muted-foreground">{field.label}</span>
              <span className="text-sm font-semibold text-foreground" dir="auto">
                {field.value}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Checkmark animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 + fields.length * 0.4 + 0.2, duration: 0.4, type: 'spring' }}
          className="flex flex-col items-center gap-2"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <motion.div
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5 + fields.length * 0.4 + 0.4, duration: 0.3 }}
            >
              <Check className="h-6 w-6 text-green-400" />
            </motion.div>
          </div>
          <p className="text-sm font-medium text-green-400">
            {allFound ? t('revealAllFound') : t('revealPartialFound')}
          </p>
        </motion.div>

        {/* Manual continue button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + fields.length * 0.4 + 0.6, duration: 0.3 }}
        >
          <Button
            onClick={handleRevealContinue}
            className="gap-2"
          >
            {t('nextStep')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    )
  }

  /* ─── Step 3: Confirm Profile ─── */

  function renderStep3() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t('step2Title')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('step2Description')}
          </p>
        </div>

        {/* Identity Fields */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {tProfile('title')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('companyNameAr')}{' '}
                <span className="text-red-400">*</span>
              </label>
              <Input
                value={data.nameAr}
                onChange={(e) => handleFieldChange('nameAr', e.target.value)}
                placeholder={tProfile('companyNameArPlaceholder')}
                error={errors.nameAr}
                dir="rtl"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('companyNameEn')}
              </label>
              <Input
                value={data.nameEn}
                onChange={(e) => handleFieldChange('nameEn', e.target.value)}
                placeholder={tProfile('companyNameEnPlaceholder')}
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('crNumber')}{' '}
                <span className="text-red-400">*</span>
              </label>
              <Input
                value={data.crNumber}
                onChange={(e) =>
                  handleFieldChange(
                    'crNumber',
                    e.target.value.replace(/\D/g, '').slice(0, 10)
                  )
                }
                placeholder={tProfile('crNumberPlaceholder')}
                error={errors.crNumber}
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('activityType')}{' '}
                <span className="text-red-400">*</span>
              </label>
              <Input
                value={data.activityType}
                onChange={(e) =>
                  handleFieldChange('activityType', e.target.value)
                }
                placeholder={tProfile('activityTypePlaceholder')}
                error={errors.activityType}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('city')}{' '}
                <span className="text-red-400">*</span>
              </label>
              <Input
                value={data.city}
                onChange={(e) => handleFieldChange('city', e.target.value)}
                placeholder={tProfile('cityPlaceholder')}
                error={errors.city}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('capital')}
              </label>
              <Input
                value={data.capital}
                onChange={(e) =>
                  handleFieldChange(
                    'capital',
                    e.target.value.replace(/\D/g, '')
                  )
                }
                placeholder={tProfile('capitalPlaceholder')}
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('crIssueDate')}
              </label>
              <Input
                type="date"
                value={data.crIssuanceDate}
                onChange={(e) =>
                  handleFieldChange('crIssuanceDate', e.target.value)
                }
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tProfile('crExpiryDate')}
              </label>
              <Input
                type="date"
                value={data.crExpiryDate}
                onChange={(e) =>
                  handleFieldChange('crExpiryDate', e.target.value)
                }
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Owners */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {tProfile('shareCapital')}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddOwner}
              className="gap-1.5 text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              {tCommon('addOwner')}
            </Button>
          </div>
          <div className="space-y-3">
            {data.owners.map((owner, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-3"
              >
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <Input
                    value={owner.name}
                    onChange={(e) =>
                      handleOwnerChange(index, 'name', e.target.value)
                    }
                    placeholder={tCommon('ownerName')}
                  />
                  <Input
                    value={owner.nationality}
                    onChange={(e) =>
                      handleOwnerChange(index, 'nationality', e.target.value)
                    }
                    placeholder={tCommon('nationality')}
                  />
                  <Input
                    value={owner.share ? String(owner.share) : ''}
                    onChange={(e) =>
                      handleOwnerChange(
                        index,
                        'share',
                        Number(e.target.value.replace(/\D/g, ''))
                      )
                    }
                    placeholder="100%"
                    dir="ltr"
                    inputMode="numeric"
                  />
                </div>
                {data.owners.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOwner(index)}
                    className="mt-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                    aria-label={tCommon('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {tCommon('branding')}
          </h3>
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {tCommon('logo')}
              </p>
              <FileUpload
                accept={{ 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] }}
                maxSize={2 * 1024 * 1024}
                bucket="logos"
                path="logos"
                onUpload={(url) =>
                  setData((prev) => ({ ...prev, logoUrl: url }))
                }
                isCircular
                previewUrl={data.logoUrl}
                uploadViaApi
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {tCommon('stamp')}
              </p>
              <FileUpload
                accept={{ 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] }}
                maxSize={2 * 1024 * 1024}
                bucket="logos"
                path="stamps"
                onUpload={(url) =>
                  setData((prev) => ({ ...prev, stampUrl: url }))
                }
                isCircular
                previewUrl={data.stampUrl}
                uploadViaApi
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {t('previousStep')}
          </Button>
          <Button onClick={handleNext} size="lg" className="gap-2">
            {t('confirmDetails')}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    )
  }

  /* ─── Step 4: Obligation Review ─── */

  function toggleObligation(type: ObligationType) {
    setConfirmedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function renderCalendarPreview() {
    return (
      <ObligationReview
        obligations={previewObligations}
        loading={previewLoading}
        confirmedTypes={confirmedTypes}
        onToggle={toggleObligation}
        hasPhysicalLocation={hasPhysicalLocation}
        onSetPhysicalLocation={setHasPhysicalLocation}
        onContinue={handleNext}
      />
    )
  }

  // Legacy inline review render removed — now handled by <ObligationReview />.
  //
  /* ─── Step 5: Contact Info ─── */

  function renderStep5() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t('step3Title')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('step3Description')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="space-y-4">
            {/* Phone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('contactPhone')}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 flex items-center text-lg ltr:left-4 rtl:right-4">
                  🇸🇦
                </span>
                <Input
                  value={data.phone}
                  onChange={(e) =>
                    handleFieldChange('phone', e.target.value)
                  }
                  placeholder={t('contactPhonePlaceholder')}
                  dir="ltr"
                  className="ltr:pl-12 rtl:pr-12"
                  inputMode="tel"
                />
              </div>
            </div>

            {/* Email (disabled) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {tCommon('email')}
              </label>
              <Input
                value={data.email}
                disabled
                dir="ltr"
                placeholder="you@company.sa"
                className="opacity-60"
              />
            </div>

            {/* Address */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('contactAddress')}
              </label>
              <Textarea
                value={data.address}
                onChange={(e) =>
                  handleFieldChange('address', e.target.value)
                }
                placeholder={t('contactAddressPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
          </div>
        </div>

        {errors.submit && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {errors.submit}
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {t('previousStep')}
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleComplete}
              disabled={isSubmitting}
            >
              {t('skipForNow')}
            </Button>
            <Button
              onClick={handleComplete}
              size="lg"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {t('completeSetup')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Render ─── */

  const visualStep = getVisualStep(step)

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </motion.div>

      {/* Step Indicator — shows 3 visual steps, not the internal 5 */}
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          {Array.from({ length: VISUAL_STEPS }, (_, i) => {
            const stepNum = i + 1
            const isActive = stepNum === visualStep
            const isCompleted = stepNum < visualStep
            const Icon = STEP_ICONS[i]

            return (
              <div key={stepNum} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <motion.div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-colors duration-300',
                      isCompleted &&
                        'border-green-500 bg-green-500/10 text-green-400',
                      isActive &&
                        'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20',
                      !isActive &&
                        !isCompleted &&
                        'border-border bg-surface-1 text-muted-foreground'
                    )}
                    animate={
                      isActive
                        ? { scale: [1, 1.05, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.3 }}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </motion.div>
                  <span
                    className={cn(
                      'hidden text-xs font-medium sm:block',
                      isActive
                        ? 'text-primary'
                        : isCompleted
                          ? 'text-green-400'
                          : 'text-muted-foreground'
                    )}
                  >
                    {stepNum === 1
                      ? t('step1Title')
                      : stepNum === 2
                        ? t('step2Title')
                        : t('step3Title')}
                  </span>
                </div>
                {/* Connector line */}
                {stepNum < VISUAL_STEPS && (
                  <div className="mx-2 h-0.5 flex-1 rounded-full bg-surface-3">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: '0%' }}
                      animate={{
                        width: isCompleted ? '100%' : '0%',
                      }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress text */}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t('stepLabel', { current: visualStep, total: VISUAL_STEPS })}
        </p>
      </div>

      {/* Step Content */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderRevealStep()}
            {step === 3 && renderStep3()}
            {step === 4 && renderCalendarPreview()}
            {step === 5 && renderStep5()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
