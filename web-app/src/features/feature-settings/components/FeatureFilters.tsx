import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormSelect } from '@/components/shared'
import { useDebounce } from '@/hooks/useDebounce'
import { useFeatureSettingsStore } from '../hooks/useFeatureSettingsStore'
import { activeFilterCount, moduleLabel } from '../lib/filter-features'
import type { FeatureStatusFilter } from '../types/feature-settings.types'

const STATUS_OPTIONS: { value: FeatureStatusFilter; label: string }[] = [
  { value: 'all', label: 'All states' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
  { value: 'locked', label: 'Locked' },
]

/** Search (debounced), module and on/off/locked filters for the Features page. */
export function FeatureFilters({
  modules,
  resultLabel,
}: {
  modules: string[]
  resultLabel: string
}) {
  const filters = useFeatureSettingsStore((s) => s.filters)
  const setFilters = useFeatureSettingsStore((s) => s.setFilters)
  const clearFilters = useFeatureSettingsStore((s) => s.clearFilters)

  const [search, setSearch] = useState(filters.search)
  const debounced = useDebounce(search, 300)
  useEffect(() => {
    setFilters({ search: debounced })
  }, [debounced, setFilters])
  // "Clear all" resets the store; mirror it in the input.
  useEffect(() => {
    if (!filters.search) setSearch('')
  }, [filters.search])

  const count = activeFilterCount({ ...filters, search })

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
      <div className="relative min-w-[200px] max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search features"
          aria-label="Search features"
          className="h-9 pl-9"
        />
      </div>
      <FormSelect
        value={filters.module}
        onValueChange={(module) => setFilters({ module })}
        options={[
          { value: 'all', label: 'All modules' },
          ...modules.map((m) => ({ value: m, label: moduleLabel(m) })),
        ]}
        containerClassName="w-44"
      />
      <FormSelect
        value={filters.status}
        onValueChange={(status) =>
          setFilters({ status: status as FeatureStatusFilter })
        }
        options={STATUS_OPTIONS}
        containerClassName="w-36"
      />
      {count > 0 && (
        <>
          <Badge variant="secondary" className="tabular-nums">
            {count} filter{count === 1 ? '' : 's'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-text-3"
            onClick={() => {
              setSearch('')
              clearFilters()
            }}
          >
            <X className="size-3.5" /> Clear all filters
          </Button>
        </>
      )}
      <span className="ml-auto pr-1 text-xs text-text-3">{resultLabel}</span>
    </div>
  )
}
