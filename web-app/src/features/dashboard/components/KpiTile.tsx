import type { ComponentType, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

export type KpiTone = 'primary' | 'emerald' | 'amber' | 'violet' | 'danger'

const TONE: Record<KpiTone, { icon: string; glow: string; stroke: string }> = {
  primary: {
    icon: 'bg-primary-soft text-primary-text',
    glow: 'bg-primary/15',
    stroke: 'var(--primary)',
  },
  emerald: {
    icon: 'bg-emerald-soft text-emerald',
    glow: 'bg-emerald/15',
    stroke: 'var(--emerald)',
  },
  amber: {
    icon: 'bg-amber-soft text-amber',
    glow: 'bg-amber/15',
    stroke: 'var(--amber)',
  },
  violet: {
    icon: 'bg-violet-soft text-violet',
    glow: 'bg-violet/15',
    stroke: 'var(--violet)',
  },
  danger: {
    icon: 'bg-danger-soft text-danger',
    glow: 'bg-danger/15',
    stroke: 'var(--danger)',
  },
}

interface KpiTileProps {
  label: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
  tone?: KpiTone
  /** Footer line under the value (trend chip, progress, hint…). */
  footer?: ReactNode
  /** Small trend line drawn in the corner (e.g. revenue per day). */
  sparkline?: number[]
  /** Makes the whole tile a link to the page behind the number. */
  to?: string
  isLoading?: boolean
}

/** Dashboard KPI tile: tinted icon, big tabular number, footer, optional sparkline. */
export function KpiTile({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  footer,
  sparkline,
  to,
  isLoading,
}: KpiTileProps) {
  const t = TONE[tone]
  const hasSpark = !!sparkline && sparkline.some((v) => v > 0)

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-2xl transition-opacity group-hover:opacity-100',
          t.glow,
          'opacity-60',
        )}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-lg',
              t.icon,
            )}
          >
            <Icon className="size-[18px]" />
          </span>
          <span className="text-sm font-medium text-text-2">{label}</span>
        </div>
        {to && (
          <ArrowUpRight className="size-4 text-text-3 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {isLoading ? (
            <div className="h-8 w-28 animate-pulse rounded-md bg-panel-2" />
          ) : (
            <div className="truncate text-[28px] font-bold leading-none tracking-tight tabular-nums text-foreground">
              {value}
            </div>
          )}
          {footer && <div className="mt-3 text-xs text-text-3">{footer}</div>}
        </div>
        {hasSpark && (
          <div className="h-10 w-24 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sparkline.map((v, i) => ({ i, v }))}
                margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`spark-${tone}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={t.stroke} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={t.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={t.stroke}
                  strokeWidth={2}
                  fill={`url(#spark-${tone})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  )

  const className =
    'group relative block overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-sm transition-all'

  return to ? (
    <Link
      to={to}
      className={cn(
        className,
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** Small "+12% vs last month" chip used in KPI footers. */
export function TrendChip({
  value,
  suffix,
}: {
  value: number
  suffix: string
}) {
  const up = value >= 0
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 font-semibold tabular-nums',
          up ? 'bg-emerald-soft text-emerald' : 'bg-danger-soft text-danger',
        )}
      >
        {up ? '▲' : '▼'} {Math.abs(value)}%
      </span>
      {suffix}
    </span>
  )
}
