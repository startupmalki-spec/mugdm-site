'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
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
} from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/upload/FileUpload'
import { isValidCRNumber } from '@/lib/validations'
import { cn } from '@/lib/utils'

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

const TOTAL_STEPS = 3
const SIMULATED_ANALYSIS_DELAY_MS = 2500

const STEP_ICONS = [Upload, Building2, Phone] as const

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
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [data, setData] = useState<WizardData>(INITIAL_DATA)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* ─── Navigation ─── */

  const handleNext = useCallback(() => {
    if (step === 2) {
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
      setErrors({})
    }

    setDirection(1)
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS))
  }, [step, data, tCommon, tProfile])

  const handleBack = useCallback(() => {
    setDirection(-1)
    setStep((prev) => Math.max(prev - 1, 1))
  }, [])

  /* ─── CR Upload Handler ─── */

  const handleCRUpload = useCallback(
    (url: string) => {
      setData((prev) => ({ ...prev, crDocumentUrl: url }))

      // Simulate AI analysis then advance to step 2
      setIsAnalyzing(true)
      setDirection(1)

      setTimeout(() => {
        setIsAnalyzing(false)
        setStep(2)
      }, SIMULATED_ANALYSIS_DELAY_MS)
    },
    []
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
        cr_document_url: data.crDocumentUrl || undefined,
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to create business')
      }

      router.push('/')
    } catch {
      setErrors({ submit: tCommon('error') })
    } finally {
      setIsSubmitting(false)
    }
  }, [data, router, tCommon])

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
              {t('processingDescription')}
            </p>
          </div>
        </motion.div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t('step1Title')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('step1Description')}
          </p>
        </div>

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
      </div>
    )
  }

  /* ─── Step 2: Confirm Profile ─── */

  function renderStep2() {
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
              {tCommon('next') === 'Next' ? 'Add Owner' : 'إضافة مالك'}
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
                    placeholder={
                      tCommon('next') === 'Next' ? 'Owner name' : 'اسم المالك'
                    }
                  />
                  <Input
                    value={owner.nationality}
                    onChange={(e) =>
                      handleOwnerChange(index, 'nationality', e.target.value)
                    }
                    placeholder={
                      tCommon('next') === 'Next' ? 'Nationality' : 'الجنسية'
                    }
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
            {tCommon('next') === 'Next' ? 'Branding' : 'الهوية البصرية'}
          </h3>
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {tCommon('next') === 'Next' ? 'Logo' : 'الشعار'}
              </p>
              <FileUpload
                accept={{ 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] }}
                maxSize={2 * 1024 * 1024}
                bucket="branding"
                path="logos"
                onUpload={(url) =>
                  setData((prev) => ({ ...prev, logoUrl: url }))
                }
                isCircular
                previewUrl={data.logoUrl}
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {tCommon('next') === 'Next' ? 'Stamp' : 'الختم'}
              </p>
              <FileUpload
                accept={{ 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] }}
                maxSize={2 * 1024 * 1024}
                bucket="branding"
                path="stamps"
                onUpload={(url) =>
                  setData((prev) => ({ ...prev, stampUrl: url }))
                }
                isCircular
                previewUrl={data.stampUrl}
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

  /* ─── Step 3: Contact Info ─── */

  function renderStep3() {
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
                {tCommon('next') === 'Next' ? 'Email' : 'البريد الإلكتروني'}
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

      {/* Step Indicator */}
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const stepNum = i + 1
            const isActive = stepNum === step
            const isCompleted = stepNum < step
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
                {stepNum < TOTAL_STEPS && (
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
          {t('stepLabel', { current: step, total: TOTAL_STEPS })}
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
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
