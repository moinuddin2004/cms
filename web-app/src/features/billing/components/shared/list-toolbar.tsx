import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { cn } from '@/lib/utils'
import { CollapsibleFilters } from '@/components/shared/CollapsibleFilters'
import { dateToYmd, todayYmd, ymdToDate } from '@/lib/datetime'

/**
 * Listing chrome copied from the Appointments page so billing lists look
 * the same: a one-row stats strip, a toolbar card with a top row and a
 * `border-t` filter row, segmented pills and date presets.
 */

export interface StatItem {
  key: string
  label: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
  /** Text + soft background tone, e.g. `text-emerald` / `bg-emerald-soft`. */
  color: string
  bg: string
}

const COLS: Record<number, string> = {
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
}

export function StatsStrip({
  items,
  isLoading,
}: {
  items: StatItem[]
  isLoading?: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 divide-x divide-y rounded-xl border bg-card sm:divide-y-0',
        COLS[items.length],
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.key}
            className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/40"
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                item.bg,
              )}
            >
              <Icon className={cn('size-4', item.color)} />
            </span>
            <div className="min-w-0 leading-none">
              <p className="truncate text-[11px] font-medium text-text-3">
                {item.label}
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-4 w-14" />
              ) : (
                <p className="mt-1 truncate text-base font-bold leading-none tabular-nums">
                  {item.value}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Toolbar card: `left` (period / presets), an optional filter row below and a
 * `right` slot. On mobile `left` + `filters` fold behind one "Filters"
 * button; `right` stays visible.
 */
export function ListToolbar({
  left,
  right,
  filters,
  activeCount = 0,
}: {
  left?: ReactNode
  right?: ReactNode
  filters?: ReactNode
  activeCount?: number
}) {
  const [open, setOpen] = useState(false)
  const foldable = !!(left || filters)
  return (
    <div className="space-y-2 rounded-xl border bg-card px-3 py-2">
      {foldable && (
        <div className="flex items-center gap-2 sm:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 justify-between"
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
              className={cn(
                'size-4 transition-transform',
                open && 'rotate-180',
              )}
            />
          </Button>
          {right}
        </div>
      )}
      <div className={cn('space-y-2', open ? 'block' : 'hidden', 'sm:block')}>
        {(left || right) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
              {left}
            </div>
            <div className="hidden items-center gap-2 sm:flex">{right}</div>
          </div>
        )}
        {filters && (
          <CollapsibleFilters
            bare
            className={cn((left || right) && 'border-t pt-2')}
          >
            {filters}
          </CollapsibleFilters>
        )}
      </div>
      {!foldable && right && (
        <div className="flex items-center gap-2 sm:hidden">{right}</div>
      )}
    </div>
  )
}

/** Segmented pills (the Appointments calendar-view switcher). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{
    value: T
    label: ReactNode
    icon?: ComponentType<{ className?: string }>
  }>
}) {
  return (
    <div className="col-span-2 flex w-full flex-wrap items-center rounded-[9px] border border-border bg-surface p-[3px] sm:col-span-1 sm:w-auto">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 py-[5px] text-[13px] font-medium transition-colors sm:flex-none',
            value === v
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-2 hover:text-foreground',
          )}
        >
          {Icon && <Icon className="size-3" />}
          {label}
        </button>
      ))}
    </div>
  )
}

/** "Live" pulse while a list refetches. */
export function LiveDot({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      live
    </span>
  )
}

export type RangePreset =
  'today' | 'month' | 'lastMonth' | 'past30' | 'all' | 'custom'
export interface DateRange {
  from?: string
  to?: string
}

const ymd = dateToYmd

/** Clinic-local `{from, to}` of a preset (custom → `custom`). */
export function presetRange(p: RangePreset, custom: DateRange = {}): DateRange {
  // Clinic "today" as a calendar-day carrier; plain local math from here.
  const t = ymdToDate(todayYmd())
  switch (p) {
    case 'today':
      return { from: ymd(t), to: ymd(t) }
    case 'month':
      return {
        from: ymd(new Date(t.getFullYear(), t.getMonth(), 1)),
        to: ymd(t),
      }
    case 'lastMonth':
      return {
        from: ymd(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
        to: ymd(new Date(t.getFullYear(), t.getMonth(), 0)),
      }
    case 'past30': {
      const from = new Date(t)
      from.setDate(t.getDate() - 29)
      return { from: ymd(from), to: ymd(t) }
    }
    case 'custom':
      return custom
    case 'all':
      return {}
  }
}

const PRESET_LABEL: Record<Exclude<RangePreset, 'custom'>, string> = {
  today: 'Today',
  month: 'This month',
  lastMonth: 'Last month',
  past30: 'Past 30 days',
  all: 'All',
}

/** Date preset buttons + custom range picker (Appointments list style). */
export function DatePresetBar({
  presets,
  preset,
  custom,
  onChange,
  fallback,
}: {
  presets: Array<Exclude<RangePreset, 'custom'>>
  preset: RangePreset
  custom: DateRange
  onChange: (preset: RangePreset, custom: DateRange) => void
  /** Preset to fall back to when the custom range is cleared. */
  fallback: Exclude<RangePreset, 'custom'>
}) {
  return (
    <>
      <div className="col-span-2 grid grid-cols-3 gap-1 sm:col-span-1 sm:flex sm:flex-wrap sm:items-center">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p, custom)}
            className={cn(
              'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
              preset === p
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>
      <DateRangePicker
        aria-label="Custom date range"
        className={cn(
          'col-span-2 h-8 w-full text-xs sm:col-span-1 sm:w-[240px]',
          preset === 'custom' && 'border-primary',
        )}
        value={preset === 'custom' ? custom : {}}
        onChange={(r) =>
          r.from
            ? onChange('custom', { from: r.from, to: r.to })
            : onChange(fallback, {})
        }
        placeholder="Custom range"
      />
    </>
  )
}
