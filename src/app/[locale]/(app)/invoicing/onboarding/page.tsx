'use client'

/**
 * ZATCA Onboarding Wizard (Task 56)
 *
 * 5 steps:
 *   1. Intro + consent
 *   2. VAT + CR entry
 *   3. OTP entry → triggers server-side CSR generation + `requestComplianceCsid`
 *   4. Sample-invoice compliance check (`submitComplianceInvoice`)
 *   5. Production CSID (`requestProductionCsid`) → done screen
 *
 * Steps 3–5 are orchestrated by POST /api/zatca/onboarding in a single call;
 * the UI reflects sub-phase progress via a local state machine while the
 * request is in flight.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'

import { Stepper } from './_components/Stepper'
import { StepIntro } from './_components/StepIntro'
import { StepCredentials } from './_components/StepCredentials'
import { StepOtp } from './_components/StepOtp'
import { StepCompliance } from './_components/StepCompliance'
import { StepDone } from './_components/StepDone'

type WizardStep = 1 | 2 | 3 | 4 | 5
type CompliancePhase = 'csr' | 'compliance-check' | 'production-csid' | 'done'

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
}

export default function ZatcaOnboardingPage() {
  const t = useTranslations('invoicing.onboarding')

  const [step, setStep] = useState<WizardStep>(1)
  const [direction, setDirection] = useState(1)

  const [consented, setConsented] = useState(false)
  const [vatNumber, setVatNumber] = useState('')
  const [crNumber, setCrNumber] = useState('')
  const [otp, setOtp] = useState('')

  const [isBusy, setIsBusy] = useState(false)
  const [phase, setPhase] = useState<CompliancePhase>('csr')
  const [error, setError] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const goTo = (next: WizardStep) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const stepLabels = [
    t('stepper.intro'),
    t('stepper.credentials'),
    t('stepper.otp'),
    t('stepper.compliance'),
    t('stepper.done'),
  ]

  const busyLabelForPhase: Record<CompliancePhase, string> = {
    csr: t('compliance.phaseCsr'),
    'compliance-check': t('compliance.phaseCheck'),
    'production-csid': t('compliance.phaseProd'),
    done: t('compliance.phaseProd'),
  }

  async function handleSubmitOtp() {
    setError(null)
    setIsBusy(true)
    setPhase('csr')
    // Advance to the compliance-progress step so the user sees the sub-phases.
    goTo(4)

    try {
      // Simulate visible phase transitions while the single API call runs.
      // The API does all three internally; we flip phases on a short timer so
      // the UI reflects progress.
      const phaseTimer1 = setTimeout(() => setPhase('compliance-check'), 1200)
      const phaseTimer2 = setTimeout(() => setPhase('production-csid'), 3000)

      const res = await fetch('/api/zatca/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vatNumber, crNumber, otp }),
      })

      clearTimeout(phaseTimer1)
      clearTimeout(phaseTimer2)

      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        certificate?: { expiresAt?: string }
      }

      if (!res.ok) {
        setError(body.error ?? t('errors.generic'))
        setIsBusy(false)
        // Stay on step 4 so user sees the error in-context.
        return
      }

      setPhase('done')
      setExpiresAt(body.certificate?.expiresAt ?? null)
      setIsBusy(false)
      goTo(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'))
      setIsBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">{t('pageTitle')}</h1>
        <p className="text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <Stepper total={5} current={step} labels={stepLabels} />

      <div className="rounded-xl border border-border bg-surface-1 p-6 md:p-8 min-h-[420px] overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            {step === 1 && (
              <StepIntro
                consented={consented}
                onConsentChange={setConsented}
                onNext={() => goTo(2)}
              />
            )}
            {step === 2 && (
              <StepCredentials
                vatNumber={vatNumber}
                crNumber={crNumber}
                onChange={(v) => {
                  setVatNumber(v.vatNumber)
                  setCrNumber(v.crNumber)
                }}
                onNext={() => goTo(3)}
                onBack={() => goTo(1)}
              />
            )}
            {step === 3 && (
              <StepOtp
                otp={otp}
                onOtpChange={setOtp}
                onSubmit={handleSubmitOtp}
                onBack={() => goTo(2)}
                isBusy={isBusy}
                busyLabel={busyLabelForPhase[phase]}
                error={error}
              />
            )}
            {step === 4 && <StepCompliance phase={phase} error={error} />}
            {step === 5 && <StepDone expiresAt={expiresAt} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
