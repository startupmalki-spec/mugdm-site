import { Skeleton } from '@/components/ui/skeleton'

export default function BillingLoading() {
  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Current Plan card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      {/* Upgrade options card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="mb-4 h-6 w-36" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>

      {/* Usage card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="mb-4 h-6 w-28" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  )
}
