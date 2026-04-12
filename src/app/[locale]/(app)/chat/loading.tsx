import { Skeleton } from '@/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Sidebar skeleton */}
      <div className="hidden w-64 shrink-0 border-r border-border bg-card p-4 md:block">
        <Skeleton className="mb-4 h-9 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Messages area */}
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
          <Skeleton className="h-20 w-3/4 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
        </div>

        {/* Input bar skeleton */}
        <div className="border-t border-border p-4">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
