'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepperProps {
  total: number
  current: number
  labels?: string[]
}

export function Stepper({ total, current, labels }: StepperProps) {
  return (
    <div className="flex items-center justify-between w-full mb-10">
      {Array.from({ length: total }).map((_, i) => {
        const stepNum = i + 1
        const isDone = stepNum < current
        const isCurrent = stepNum === current
        return (
          <div key={stepNum} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  isDone && 'bg-primary border-primary text-primary-foreground',
                  isCurrent &&
                    'border-primary text-primary bg-primary/10 shadow-lg shadow-primary/20',
                  !isDone && !isCurrent && 'border-border text-muted-foreground',
                )}
              >
                {isDone ? <Check className="w-5 h-5" /> : stepNum}
              </div>
              {labels?.[i] && (
                <span
                  className={cn(
                    'text-[11px] mt-2 text-center max-w-[90px] leading-tight',
                    isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}
                >
                  {labels[i]}
                </span>
              )}
            </div>
            {stepNum < total && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 transition-colors',
                  stepNum < current ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
