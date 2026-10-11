import { useMemo, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/shared/DatePicker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Doctor } from '@/features/appointments/types'

// ─── Date helpers ──────────────────────────────────────────────────────
function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromYMD(value: string): Date {
  // Anchor at noon so timezone math never rolls the day over.
  return new Date(value + 'T12:00:00')
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// ─── Props ──────────────────────────────────────────────────────────────
export interface AppointmentsToolbarProps {
  /** The currently-selected day. `null` highlights no day in the strip
   *  (e.g. the List view sitting on a multi-day range preset). */
  selectedDate: Date | null
  onSelectDate: (date: Date) => void

  doctors: Doctor[]
  doctorFilter: string
  onDoctorChange: (id: string) => void

  /** Render the scrollable day strip. Default: true. */
  showStrip?: boolean
  /** Number of days in the strip. Default: 14. */
  stripDays?: number
  /** Override the prev/next step (e.g. step a whole week in calendar week
   *  view). When omitted, prev/next move the selection by one day. */
  onStepPrev?: () => void
  onStepNext?: () => void

  /** Subtle "live" pulse shown while data refetches. */
  isFetching?: boolean
  /** Context label next to the date picker (e.g. a week range). */
  label?: ReactNode
  /** Right-aligned slot for view switchers / Walk-in / counts. */
  actions?: ReactNode
  /** Extra filter controls (search, presets, status…) rendered as their own
   *  row inside the same card — used by the List view. */
  filters?: ReactNode
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────
export function AppointmentsToolbar({
  selectedDate,
  onSelectDate,
  doctors,
  doctorFilter,
  onDoctorChange,
  showStrip = true,
  stripDays = 14,
  onStepPrev,
  onStepNext,
  isFetching,
  label,
  actions,
  filters,
  className,
}: AppointmentsToolbarProps) {
  const selectedYMD = selectedDate ? toYMD(selectedDate) : null
  const todayYMD = toYMD(new Date())

  // Strip slides with the selection — anchored on the selected day, or today
  // when nothing is selected.
  const strip = useMemo(() => {
    const anchor = new Date(selectedDate ?? new Date())
    anchor.setHours(0, 0, 0, 0)
    const center = Math.floor((stripDays - 1) / 2)
    return Array.from({ length: stripDays }, (_, i) => {
      const d = new Date(anchor)
      d.setDate(anchor.getDate() - center + i)
      return d
    })
  }, [selectedYMD, stripDays]) // eslint-disable-line react-hooks/exhaustive-deps

  const stepPrev =
    onStepPrev ??
    (() => {
      const d = selectedDate ?? new Date()
      const next = new Date(d)
      next.setDate(d.getDate() - 1)
      onSelectDate(next)
    })

  const stepNext =
    onStepNext ??
    (() => {
      const d = selectedDate ?? new Date()
      const next = new Date(d)
      next.setDate(d.getDate() + 1)
      onSelectDate(next)
    })

  const goToToday = () => onSelectDate(fromYMD(todayYMD))
  const isOnToday = selectedYMD === todayYMD

  const doctorActive = doctorFilter !== 'all'

  return (
    <div
      className={cn(
        'bg-card border rounded-xl px-3 py-2 space-y-2',
        className,
      )}
    >
      {/* Row 1: jump-to-date + doctor filter + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
              Jump to
            </span>
            <DatePicker
              value={selectedYMD ?? ''}
              onChange={(v) => {
                if (v) onSelectDate(fromYMD(v))
              }}
              hideIcon
              className="h-6 w-auto border-0 bg-transparent px-1 text-xs font-medium shadow-none hover:bg-accent"
            />
          </div>

          {!isOnToday && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 px-2.5 text-xs"
            >
              Today
            </Button>
          )}

          {label && (
            <span className="ml-1 hidden text-sm font-semibold text-foreground md:inline">
              {label}
            </span>
          )}

          {isFetching && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={doctorFilter} onValueChange={onDoctorChange}>
            <SelectTrigger
              size="sm"
              className={cn(
                'h-8 w-[170px] text-xs',
                doctorActive && 'border-primary/50 text-primary ring-1 ring-primary/20',
              )}
            >
              <Stethoscope className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <SelectValue placeholder="All doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {actions}
        </div>
      </div>

      {/* Row 2: scrollable day strip */}
      {showStrip && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={stepPrev}
            className="h-8 w-6 shrink-0"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="scrollbar-hide flex flex-1 gap-1 overflow-x-auto pb-0.5">
            {strip.map((d, i) => {
              const dYMD = toYMD(d)
              const selected = dYMD === selectedYMD
              const isThisToday = dYMD === todayYMD
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              // Show the month label on the very first cell and whenever the
              // month rolls over inside the strip.
              const showMonth =
                i === 0 || (i > 0 && strip[i - 1].getMonth() !== d.getMonth())

              return (
                <button
                  key={dYMD}
                  type="button"
                  onClick={() => onSelectDate(fromYMD(dYMD))}
                  title={d.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  className={cn(
                    'flex min-w-[42px] shrink-0 flex-col items-center justify-center rounded-lg px-2 py-0.5 text-center transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : isThisToday
                        ? 'border border-primary bg-primary/5 text-primary'
                        : isWeekend
                          ? 'bg-accent/40 text-muted-foreground hover:bg-accent'
                          : 'bg-accent text-foreground hover:bg-accent/70',
                  )}
                >
                  <span
                    className={cn(
                      'text-[9px] font-bold uppercase leading-none tracking-wider',
                      selected
                        ? 'text-primary-foreground/85'
                        : showMonth
                          ? 'text-primary'
                          : isThisToday
                            ? 'text-primary'
                            : 'text-muted-foreground/70',
                    )}
                  >
                    {showMonth
                      ? MONTH_NAMES[d.getMonth()]
                      : isThisToday && !selected
                        ? 'TODAY'
                        : DAY_NAMES[d.getDay()]}
                  </span>
                  <span className="text-sm font-bold leading-tight tabular-nums">
                    {d.getDate()}
                  </span>
                </button>
              )
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={stepNext}
            className="h-9 w-6 shrink-0"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Row 3: extra filters (search, presets, status…) */}
      {filters && (
        <div className="flex flex-row flex-wrap items-center gap-2 border-t pt-2">
          {filters}
        </div>
      )}
    </div>
  )
}
