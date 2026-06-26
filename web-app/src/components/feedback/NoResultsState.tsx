import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NoResultsStateProps {
  onClear?: () => void
  message?: string
  className?: string
}

/** Distinct state for "filters returned nothing" — different from an empty dataset. */
export function NoResultsState({
  onClear,
  message = 'No results match your filters.',
  className,
}: NoResultsStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-panel-2 text-text-3">
        <SearchX className="size-7" />
      </span>
      <h3 className="text-base font-bold text-foreground">No matches found</h3>
      <p className="mt-1.5 max-w-sm text-sm text-text-2">{message}</p>
      {onClear && (
        <Button variant="outline" className="mt-5" onClick={onClear}>
          Clear all filters
        </Button>
      )}
    </div>
  )
}
