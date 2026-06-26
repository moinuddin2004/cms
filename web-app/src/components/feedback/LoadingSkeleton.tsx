import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  /** Layout to mimic while loading. */
  variant?: 'table' | 'cards' | 'stats' | 'detail'
  rows?: number
  className?: string
}

/** Shared loading skeletons so every list/detail shows structure, never a blank screen. */
export function LoadingSkeleton({
  variant = 'table',
  rows = 6,
  className,
}: LoadingSkeletonProps) {
  if (variant === 'stats') {
    return (
      <div className={cn('grid grid-cols-2 gap-4 lg:grid-cols-4', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-[18px]">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'cards') {
    return (
      <div
        className={cn(
          'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          className,
        )}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-[18px]">
            <div className="flex items-center gap-3">
              <Skeleton className="size-[42px] rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  // table
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-surface',
        className,
      )}
    >
      <div className="border-b border-border-soft bg-panel p-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-border-soft">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
