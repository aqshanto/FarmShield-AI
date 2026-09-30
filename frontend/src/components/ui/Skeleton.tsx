import { cn } from '@/lib/cn'

// Shimmering placeholder shown while content loads.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative overflow-hidden rounded-xl bg-surface-2', className)}>
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}

// Card-shaped skeleton matching the risk card layout.
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn('glass rounded-[var(--radius-card)] p-5', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={3} className="mt-5" />
    </div>
  )
}
