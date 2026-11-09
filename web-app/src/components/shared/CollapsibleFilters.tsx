import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Filter controls that collapse behind a "Filters" button on mobile (they
 * eat a lot of height) and lay out two per row; from `sm` up they are an
 * always-visible wrapping row.
 */
export function CollapsibleFilters({
  children,
  activeCount = 0,
  className,
  bare,
}: {
  children: ReactNode
  activeCount?: number
  className?: string
  /** No button of its own — the parent owns the toggle; always laid out as the grid/row. */
  bare?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn('space-y-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('w-full justify-between sm:hidden', bare && 'hidden')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" /> Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {activeCount}
            </Badge>
          )}
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </Button>
      <div
        className={cn(
          'grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap',
          open || bare ? 'grid' : 'hidden sm:flex',
          '[&>*]:min-w-0',
        )}
      >
        {children}
      </div>
    </div>
  )
}
