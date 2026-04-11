'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  secondaryActionLabel?: string
  secondaryActionHref?: string
  onSecondaryAction?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-8 py-16 text-center',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
        {icon}
      </div>

      <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            actionHref ? (
              <Button asChild>
                <Link href={actionHref as any}>{actionLabel}</Link>
              </Button>
            ) : (
              <Button onClick={onAction}>{actionLabel}</Button>
            )
          )}

          {secondaryActionLabel && (
            secondaryActionHref ? (
              <Button variant="outline" asChild>
                <Link href={secondaryActionHref as any}>{secondaryActionLabel}</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={onSecondaryAction}>{secondaryActionLabel}</Button>
            )
          )}
        </div>
      )}
    </motion.div>
  )
}
