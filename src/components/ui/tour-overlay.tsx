'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOUR_COMPLETED_KEY = 'mugdm-tour-completed'

export interface TourStep {
  /** CSS selector for the target element */
  target: string
  titleKey: string
  descriptionKey: string
}

interface TourOverlayProps {
  steps: TourStep[]
  /** Translation namespace prefix, e.g. 'dashboard' */
  ns: string
  onComplete?: () => void
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function TourOverlay({ steps, ns, onComplete }: TourOverlayProps) {
  const t = useTranslations(ns)
  const tCommon = useTranslations('common')
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Check if tour should show
  useEffect(() => {
    if (typeof window === 'undefined') return
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY)
    if (!completed) {
      // Delay slightly so dashboard elements render
      const timer = setTimeout(() => setIsVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  // Update target rect when step changes
  useEffect(() => {
    if (!isVisible || !steps[currentStep]) return

    const updateRect = () => {
      const el = document.querySelector(steps[currentStep].target)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        })
        // Scroll element into view
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        setTargetRect(null)
      }
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [isVisible, currentStep, steps])

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true')
    setIsVisible(false)
    onComplete?.()
  }, [onComplete])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      completeTour()
    }
  }, [currentStep, steps.length, completeTour])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }, [currentStep])

  if (!isVisible) return null

  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1
  const isFirst = currentStep === 0

  // Spotlight cutout dimensions with padding
  const pad = 8
  const spotTop = targetRect ? targetRect.top - pad : 0
  const spotLeft = targetRect ? targetRect.left - pad : 0
  const spotWidth = targetRect ? targetRect.width + pad * 2 : 0
  const spotHeight = targetRect ? targetRect.height + pad * 2 : 0

  // Tooltip positioning: below the target by default
  const tooltipTop = targetRect
    ? targetRect.top + targetRect.height + 16
    : '50%'
  const tooltipLeft = targetRect
    ? Math.max(16, Math.min(targetRect.left, window.innerWidth - 360))
    : '50%'

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999]"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Dark overlay with spotlight cutout using CSS clip-path */}
        <div
          className="absolute inset-0 bg-black/70 transition-all duration-300"
          style={
            targetRect
              ? {
                  clipPath: `polygon(
                    0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                    ${spotLeft}px ${spotTop}px,
                    ${spotLeft}px ${spotTop + spotHeight}px,
                    ${spotLeft + spotWidth}px ${spotTop + spotHeight}px,
                    ${spotLeft + spotWidth}px ${spotTop}px,
                    ${spotLeft}px ${spotTop}px
                  )`,
                }
              : undefined
          }
        />

        {/* Spotlight ring */}
        {targetRect && (
          <div
            className="absolute rounded-lg border-2 border-primary/60 transition-all duration-300"
            style={{
              top: spotTop,
              left: spotLeft,
              width: spotWidth,
              height: spotHeight,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className="absolute z-[10000] w-80 rounded-xl border border-border bg-card p-5 shadow-2xl"
          style={{
            top: typeof tooltipTop === 'number' ? tooltipTop : tooltipTop,
            left: typeof tooltipLeft === 'number' ? tooltipLeft : tooltipLeft,
            ...(typeof tooltipTop === 'string'
              ? { transform: 'translate(-50%, -50%)' }
              : {}),
          }}
        >
          {/* Step counter */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              type="button"
              onClick={completeTour}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label={tCommon('close')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <h3 className="text-sm font-semibold text-foreground">
            {t(step.titleKey)}
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {t(step.descriptionKey)}
          </p>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={completeTour}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('tourSkip')}
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {tCommon('back')}
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors',
                  isLast
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {isLast ? t('tourDone') : tCommon('next')}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="mt-3 flex items-center justify-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === currentStep
                    ? 'w-4 bg-primary'
                    : i < currentStep
                      ? 'w-1.5 bg-primary/40'
                      : 'w-1.5 bg-surface-3'
                )}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
