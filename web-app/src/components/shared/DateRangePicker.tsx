import { useMemo, useState } from 'react'
import {
  endOfMonth,
  endOfYear,
  format,
  isValid,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns'
import type { DateRange, Matcher } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ComboboxClear } from '@/components/shared/combobox'

/** A date range as `yyyy-MM-dd` strings; '' = not set. */
export interface DateRangeValue {
  from: string
  to: string
}

export interface DateRangePreset {
  label: string
  range: () => DateRangeValue
}

// Anchor at noon so timezone math never rolls the day over.
const fromYMD = (v: string) => new Date(v + 'T12:00:00')
const toYMD = (d: Date) => format(d, 'yyyy-MM-dd')
const span = (from: Date, to: Date): DateRangeValue => ({
  from: toYMD(from),
  to: toYMD(to),
})

/** Quick ranges shown beside the calendar. Click = select + close. */
export const DEFAULT_DATE_PRESETS: DateRangePreset[] = [
  { label: 'Today', range: () => span(new Date(), new Date()) },
  {
    label: 'Yesterday',
    range: () => span(subDays(new Date(), 1), subDays(new Date(), 1)),
  },
  {
    label: 'Last 7 days',
    range: () => span(subDays(new Date(), 6), new Date()),
  },
  {
    label: 'Last 30 days',
    range: () => span(subDays(new Date(), 29), new Date()),
  },
  {
    label: 'This month',
    range: () => span(startOfMonth(new Date()), endOfMonth(new Date())),
  },
  {
    label: 'Last month',
    range: () => {
      const m = subMonths(new Date(), 1)
      return span(startOfMonth(m), endOfMonth(m))
    },
  },
  {
    label: 'This year',
    range: () => span(startOfYear(new Date()), endOfYear(new Date())),
  },
]

const label = (v: string) => format(fromYMD(v), 'MMM dd, yyyy')

/**
 * shadcn-style range picker: a trigger showing "Jan 20, 2026 - Feb 09, 2026",
 * a popup with quick presets (Today, Last 7 days, This month…) beside a
 * two-month calendar. Click a start day, then an end day; the popup closes
 * once the range is complete. Use for every from/to date pair.
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Pick a date range',
  presets = DEFAULT_DATE_PRESETS,
  clearable = true,
  disabled,
  min,
  max,
  id,
  className,
  align = 'start',
  'aria-label': ariaLabel,
}: {
  /** Missing / '' ends mean "not set". */
  value: { from?: string; to?: string }
  onChange: (value: DateRangeValue) => void
  placeholder?: string
  /** Pass `[]` to hide the preset column. */
  presets?: DateRangePreset[]
  clearable?: boolean
  disabled?: boolean
  /** Earliest / latest selectable date, `yyyy-MM-dd`. */
  min?: string
  max?: string
  id?: string
  className?: string
  align?: 'start' | 'center' | 'end'
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  // First click of a new range; the second click completes it.
  const [anchor, setAnchor] = useState<Date | null>(null)

  const selected = useMemo<DateRange | undefined>(() => {
    if (anchor) return { from: anchor, to: undefined }
    const from = value.from ? fromYMD(value.from) : undefined
    const to = value.to ? fromYMD(value.to) : undefined
    if (!from || !isValid(from)) return undefined
    return { from, to: to && isValid(to) ? to : from }
  }, [anchor, value.from, value.to])

  const disabledDays: Matcher[] = []
  if (min) disabledDays.push({ before: fromYMD(min) })
  if (max) disabledDays.push({ after: fromYMD(max) })

  const commit = (next: DateRangeValue) => {
    onChange(next)
    setAnchor(null)
    setOpen(false)
  }

  const onDayClick = (day: Date) => {
    if (!anchor) {
      setAnchor(day)
      return
    }
    commit(day < anchor ? span(day, anchor) : span(anchor, day))
  }

  const text = value.from
    ? value.to && value.to !== value.from
      ? `${label(value.from)} - ${label(value.to)}`
      : label(value.from)
    : placeholder
  const hasValue = !!value.from
  const activePreset = presets.find((p) => {
    const r = p.range()
    return r.from === value.from && r.to === value.to
  })
  const showClear = clearable && hasValue && !disabled

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setAnchor(null)
      }}
    >
      <div
        className={cn(
          'relative inline-flex h-9 w-fit items-center rounded-md border border-input bg-surface text-sm shadow-xs transition-[color,box-shadow] has-[button:focus-visible]:border-ring has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-ring/40 dark:hover:bg-panel',
          !hasValue && 'text-muted-foreground',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className="flex h-full w-full min-w-0 items-center gap-2 rounded-[inherit] px-3 text-left outline-none disabled:cursor-not-allowed"
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" />
            <span className="min-w-0 flex-1 truncate">
              {activePreset && activePreset.label !== 'Today'
                ? `${activePreset.label} · ${text}`
                : text}
            </span>
            {showClear && <span aria-hidden className="w-5 shrink-0" />}
          </button>
        </PopoverTrigger>
        {showClear && (
          <ComboboxClear
            tooltip="Clear dates"
            onClear={() => commit({ from: '', to: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          />
        )}
      </div>
      <PopoverContent
        align={align}
        collisionPadding={8}
        className="flex w-auto max-w-[calc(100vw-1rem)] flex-col p-0 sm:flex-row"
      >
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b border-border p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => commit(p.range())}
                className={cn(
                  'rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  activePreset?.label === p.label &&
                    'bg-accent text-primary-text',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={selected}
            onDayClick={onDayClick}
            // Filters mostly look back: open on last month + this month.
            defaultMonth={selected?.from ?? subMonths(new Date(), 1)}
            disabled={disabledDays.length ? disabledDays : undefined}
            classNames={{
              months: 'relative flex flex-col gap-4 sm:flex-row',
              month_caption: 'flex h-7 items-center justify-center',
              nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
              button_previous:
                'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
              button_next:
                'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
              selected: '',
              today: '[&>button]:font-semibold [&>button]:text-primary-text',
              range_start:
                'rounded-l-md [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
              range_end:
                'rounded-r-md [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
              range_middle: '[&>button]:rounded-none',
            }}
            autoFocus
          />
          {anchor && (
            <p className="px-3 pb-2 text-center text-xs text-muted-foreground">
              Pick the end date
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
