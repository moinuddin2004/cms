import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { formatDateTime, formatInClinic, formatTime } from '@/lib/datetime'

/** Calendar-leaf date block used on appointment and visit cards / sheets. */
export function DateBlock({
  date,
  highlight,
  size = 'md',
}: {
  date: Date
  highlight?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-lg text-center',
        size === 'sm' ? 'w-11 py-1' : 'min-w-[58px] px-2 py-1.5',
        highlight
          ? 'bg-primary-soft text-primary-text'
          : 'bg-panel-2 text-foreground',
      )}
    >
      <span className="text-[10px] font-bold uppercase leading-none opacity-70">
        {formatInClinic(date, 'MMM')}
      </span>
      <span
        className={cn(
          'font-bold leading-tight tabular-nums',
          size === 'sm' ? 'text-base' : 'text-xl',
        )}
      >
        {formatInClinic(date, 'd')}
      </span>
      {size === 'md' && (
        <span className="text-[10px] leading-none opacity-70">
          {formatInClinic(date, 'EEE')}
        </span>
      )}
    </div>
  )
}

/** Small soft chip (status, walk-in, emergency …). */
export function Chip({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}

export const CHIP_TONES = {
  walkIn: 'border-violet/30 bg-violet-soft text-violet',
  emergency: 'border-danger/30 bg-danger-soft text-danger',
  success: 'border-emerald/30 bg-emerald-soft text-emerald',
  warning: 'border-amber/30 bg-amber-soft text-amber',
  danger: 'border-danger/30 bg-danger-soft text-danger',
  info: 'border-primary/20 bg-primary-soft text-primary-text',
  muted: 'border-border bg-panel-2 text-muted-foreground',
} as const

/** Titled block inside a detail sheet. */
export function DetailSection({
  icon: Icon,
  title,
  count,
  action,
  children,
}: {
  icon: LucideIcon
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3.5" />
          {title}
          {count != null && (
            <span className="rounded-full bg-panel-2 px-1.5 py-px text-[10px] tabular-nums">
              {count}
            </span>
          )}
        </h4>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Label / value cell of a detail grid. */
export function InfoItem({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm font-medium text-foreground">
        {children}
      </div>
    </div>
  )
}

/** Vertical timeline of what happened when (booked → arrived → seen …). */
export function Timeline({
  steps,
}: {
  steps: { label: string; at: string | null | undefined; tone?: 'danger' }[]
}) {
  const shown = steps.filter((s) => s.at)
  if (shown.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">No events yet.</p>
    )
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {shown.map((s) => (
        <li key={s.label} className="relative">
          <span
            className={cn(
              'absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-4 ring-background',
              s.tone === 'danger' ? 'bg-danger' : 'bg-primary',
            )}
          />
          <p className="text-sm font-medium">{s.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(s.at as string)}
          </p>
        </li>
      ))}
    </ol>
  )
}

/** Search box used by the appointments / visits filter rows. */
export function HistorySearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 pr-8 text-sm"
      />
      {value && (
        <TooltipButton
          tooltip="Clear search"
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 size-7 -translate-y-1/2"
          onClick={() => onChange('')}
        >
          <X className="size-3.5" />
        </TooltipButton>
      )}
    </div>
  )
}

export const timeOf = (d: Date) => formatTime(d)

export const num = (v: number | string | null | undefined) =>
  v == null ? 0 : typeof v === 'string' ? parseFloat(v) || 0 : v
