import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { useLang } from '@/lib/i18n'

// Mirrors the dashboard layout so nothing jumps when the data arrives.
export function DashboardSkeleton() {
  const label = useLang() === 'bn' ? 'আপনার খামার লোড হচ্ছে' : 'Loading your farm'
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <SkeletonCard className="min-h-80 lg:col-span-2" />
        <SkeletonCard className="min-h-80 lg:col-span-3" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <SkeletonCard className="min-h-72" />
        <SkeletonCard className="min-h-72" />
        <SkeletonCard className="min-h-72" />
      </div>
    </div>
  )
}
