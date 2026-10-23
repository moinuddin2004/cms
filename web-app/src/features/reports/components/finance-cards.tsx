import type { ComponentType, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'

/**
 * Dashboard building blocks shared by the finance and clinic overviews.
 *
 * Colour carries meaning only: primary = volume, emerald = good,
 * danger = bad, amber = needs attention, neutral = everything else.
 */
export type Tone =
  | 'primary'
  | 'emerald'
  | 'amber'
  | 'danger'
  | 'violet'
  | 'neutral'

const BAR: Record<Tone, string> = {
  primary: 'bg-primary',
  emerald: 'bg-emerald',
  amber: 'bg-amber',
  danger: 'bg-danger',
  violet: 'bg-violet',
  neutral: 'bg-text-3',
}

const CHIP: Record<'good' | 'bad' | 'flat', string> = {
  good: 'bg-emerald-soft text-emerald',
  bad: 'bg-danger-soft text-danger',
  flat: 'bg-panel text-text-2',
}

/** A change against the previous period, already worded ("+25%", "−3 min"). */
export interface Change {
  text: string
  /** null = no better / worse (flat). */
  good: boolean | null
}

/** `+12%` style change, or nothing when there is no earlier value to compare. */
export function percentChange(
  changePct: number | null | undefined,
  goodWhenUp = true,
): Change | undefined {
  if (changePct == null) return undefined
  const up = changePct > 0
  return {
    text: `${up ? '+' : changePct < 0 ? '−' : ''}${Math.abs(changePct)}%`,
    good: changePct === 0 ? null : up === goodWhenUp,
  }
}

/** Absolute change ("−3 min", "+10 pts"), or nothing without both values. */
export function absoluteChange(
  value: number | null | undefined,
  previous: number | null | undefined,
  unit: string,
  goodWhenUp = true,
): Change | undefined {
  if (value == null || previous == null) return undefined
  const d = Math.round((value - previous) * 10) / 10
  return {
    text: `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)} ${unit}`,
    good: d === 0 ? null : d > 0 === goodWhenUp,
  }
}

/** Tiny trend line; nothing for fewer than two points. */
export function Sparkline({ values }: { values: Array<number | null> }) {
  const pts = values.map((v) => v ?? 0)
  if (pts.length < 2 || pts.every((v) => v === 0))
    return <div className="h-6" />
  const min = Math.min(...pts)
  const span = Math.max(...pts) - min || 1
  const step = 100 / (pts.length - 1)
  const points = pts
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(22 - ((v - min) / span) * 20).toFixed(1)}`,
    )
    .join(' ')
  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className="h-6 w-full"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Headline number: label, value, change chip, one supporting line, sparkline. */
export function KpiTile({
  label,
  value,
  change,
  hint,
  trend,
  emphasis,
}: {
  label: string
  value: ReactNode
  change?: Change
  hint?: ReactNode
  trend?: Array<number | null>
  /** Colours the value (profit green / loss red). */
  emphasis?: 'good' | 'bad'
}) {
  const tone = !change
    ? null
    : change.good === null
      ? 'flat'
      : change.good
        ? 'good'
        : 'bad'
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface px-4 pt-3.5 pb-3">
      <div className="text-[13px] font-medium text-text-2">{label}</div>
      <div
        className={cn(
          'mt-1 truncate text-[26px] font-extrabold leading-tight tracking-tight tabular-nums',
          emphasis === 'good' && 'text-emerald',
          emphasis === 'bad' && 'text-danger',
        )}
      >
        {value}
      </div>
      <div className="mt-1 flex min-h-[20px] items-center gap-2 text-xs">
        {change && tone && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-semibold tabular-nums',
              CHIP[tone],
            )}
          >
            {change.text}
          </span>
        )}
        {hint && <span className="truncate text-text-3">{hint}</span>}
      </div>
      {trend && (
        <div className="mt-2">
          <Sparkline values={trend} />
        </div>
      )}
    </div>
  )
}

/** Dashboard card: title row (+ optional link to a report) and body. */
export function DashCard({
  title,
  subtitle,
  link,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: ReactNode
  /** Report key the card links to. */
  link?: { report: string; label: string }
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border bg-surface p-5',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-text-3">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {link && (
            <Link
              to="/reports/$reportKey"
              params={{ reportKey: link.report }}
              className="flex items-center gap-1 text-xs font-medium text-primary-text hover:underline"
            >
              {link.label}
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

/** Ranked amounts with proportional bars, all in one colour. */
export function BarList({
  items,
  tone = 'primary',
  empty,
  showShare = true,
  format = formatCurrency,
  limit,
}: {
  items: Array<{ key?: string; label: string; amount: number; hint?: string }>
  tone?: Tone
  empty: string
  showShare?: boolean
  /** How an amount reads; money by default (pass a counter for counts). */
  format?: (n: number) => string
  limit?: number
}) {
  const shown = (limit ? items.slice(0, limit) : items).filter(
    (i) => i.amount !== 0,
  )
  const total = items.reduce((a, i) => a + Math.max(i.amount, 0), 0)
  const max = Math.max(...shown.map((i) => Math.abs(i.amount)), 1)
  if (!shown.length || total === 0) {
    return <p className="py-6 text-center text-sm text-text-3">{empty}</p>
  }
  return (
    <ul className="space-y-3">
      {shown.map((i) => (
        <li key={i.key ?? i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {i.label}
              {i.hint && (
                <span className="ml-1.5 text-xs text-text-3">{i.hint}</span>
              )}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {format(i.amount)}
              {showShare && (
                <span className="ml-2 inline-block w-9 text-right text-xs font-normal text-text-3">
                  {Math.round((Math.max(i.amount, 0) / total) * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel">
            <div
              className={cn('h-full rounded-full', BAR[tone])}
              style={{
                width: `${Math.max(2, (Math.abs(i.amount) / max) * 100)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** One 100% bar split into coloured parts, with a legend underneath. */
export function StackedBar({
  segments,
  format = (n) => n.toLocaleString('en-PK'),
  empty,
}: {
  segments: Array<{ key: string; label: string; value: number; tone: Tone }>
  format?: (n: number) => string
  empty: string
}) {
  const total = segments.reduce((a, s) => a + Math.max(s.value, 0), 0)
  if (total === 0)
    return <p className="py-4 text-center text-sm text-text-3">{empty}</p>
  const parts = segments.filter((s) => s.value > 0)
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-panel">
        {parts.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${format(s.value)}`}
            className={cn(
              'h-full border-r-2 border-surface last:border-r-0',
              BAR[s.tone],
            )}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
        {segments.map((s) => (
          <li
            key={s.key}
            className={cn(
              'flex items-center gap-1.5',
              !s.value && 'text-text-3',
            )}
          >
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                s.value ? BAR[s.tone] : 'bg-border',
              )}
            />
            <span className="truncate">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">
              {format(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface AttentionItem {
  key: string
  label: string
  /** Number / amount to show; 0 / '' renders the row as done. */
  value: number
  display?: string
  icon: ComponentType<{ className?: string }>
  tone: 'danger' | 'amber' | 'primary'
  /** Report that lists the people / documents behind the number. */
  report?: string
}

const ATTENTION_TONE: Record<AttentionItem['tone'], string> = {
  danger: 'bg-danger-soft text-danger',
  amber: 'bg-amber-soft text-amber',
  primary: 'bg-primary-soft text-primary-text',
}

/**
 * What someone should act on — open items first, then `notes` (data
 * caveats), cleared items muted at the end.
 */
export function AttentionList({
  items,
  notes = [],
}: {
  items: AttentionItem[]
  notes?: string[]
}) {
  const open = items.filter((i) => i.value)
  const done = items.filter((i) => !i.value)
  return (
    <ul className="divide-y divide-border-soft">
      {open.length === 0 && notes.length === 0 && (
        <li className="flex items-center gap-2 pb-3 text-sm font-medium text-emerald">
          <CheckCircle2 className="size-4" />
          Nothing needs attention right now
        </li>
      )}
      {open.map((i) => {
        const Icon = i.icon
        const body = (
          <>
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-[9px]',
                ATTENTION_TONE[i.tone],
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm">{i.label}</span>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {i.display ?? i.value}
            </span>
            {i.report && (
              <ArrowRight className="size-3.5 shrink-0 text-text-3 group-hover:text-foreground" />
            )}
          </>
        )
        return (
          <li key={i.key}>
            {i.report ? (
              <Link
                to="/reports/$reportKey"
                params={{ reportKey: i.report }}
                className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-panel"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-2.5">{body}</div>
            )}
          </li>
        )
      })}
      {notes.map((n) => (
        <li
          key={n}
          className="flex items-start gap-3 py-2.5 text-xs text-amber"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-amber-soft">
            <AlertTriangle className="size-4" />
          </span>
          <span className="pt-0.5">{n}</span>
        </li>
      ))}
      {done.map((i) => (
        <li
          key={i.key}
          className="flex items-center gap-3 py-2 text-xs text-text-3"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald" />
          <span className="truncate">{i.label}: none</span>
        </li>
      ))}
    </ul>
  )
}
