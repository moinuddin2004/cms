import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

/** Error state with a retry action. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn’t load this data. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="size-7" />
      </span>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-text-2">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCw className="size-4" />
          Try again
        </Button>
      )}
    </div>
  )
}
