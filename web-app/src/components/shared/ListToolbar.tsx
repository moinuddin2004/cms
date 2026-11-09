import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ViewToggle } from '@/components/shared'
import { CollapsibleFilters } from '@/components/shared/CollapsibleFilters'
import type { ViewMode } from '@/components/shared'

/**
 * The filter row listing pages share: search, page-specific filters, an
 * active-filter count with "Clear all", the count of results, and the
 * card / list switch.
 */
export function ListToolbar({
  search,
  onSearch,
  placeholder,
  filters,
  activeFilters,
  onClear,
  resultLabel,
  viewMode,
  onViewMode,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  filters?: ReactNode
  /** How many filters are on (search counts), for the badge. */
  activeFilters: number
  onClear: () => void
  resultLabel: string
  viewMode: ViewMode
  onViewMode: (mode: ViewMode) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2">
      {/* Row 1: search + result count + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-9 pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-3 hover:bg-accent"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <span className="ml-auto pr-1 text-xs text-text-3">{resultLabel}</span>
        <ViewToggle value={viewMode} onChange={onViewMode} size="sm" />
      </div>

      {/* Row 2: filters (wraps on mobile) */}
      {(filters || activeFilters > 0) && (
        <CollapsibleFilters activeCount={activeFilters}>
          {filters}

          {activeFilters > 0 && (
            <div className="col-span-2 flex items-center gap-2">
              <Badge variant="secondary" className="tabular-nums">
                {activeFilters} filter{activeFilters === 1 ? '' : 's'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-text-3"
                onClick={onClear}
              >
                <X className="size-3.5" /> Clear all filters
              </Button>
            </div>
          )}
        </CollapsibleFilters>
      )}
    </div>
  )
}
