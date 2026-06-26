import type { ComponentType, ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type IconTone = 'primary' | 'emerald' | 'amber' | 'danger' | 'violet'

const ICON_TONE: Record<IconTone, string> = {
  primary: 'bg-primary-soft text-primary-text',
  emerald: 'bg-emerald-soft text-emerald',
  amber: 'bg-amber-soft text-amber',
  danger: 'bg-danger-soft text-danger',
  violet: 'bg-violet-soft text-violet',
}

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ComponentType<{ className?: string }>
  iconTone?: IconTone
  /** Optional supporting line under the value. */
  hint?: ReactNode
  /** Percentage change; positive => emerald up, negative => danger down. */
  trend?: number
  trendSuffix?: string
  className?: string
}

/** KPI card matching the MedTrackr `.kpi` style — hover lift + primary border. */
export function StatCard({
  label,
  value,
  icon: Icon,
  iconTone = 'primary',
  hint,
  trend,
  trendSuffix = 'vs last month',
  className,
}: StatCardProps) {
  const hasTrend = typeof trend === 'number'
  const up = (trend ?? 0) >= 0
  return (
    <div
      className={cn(
        'group rounded-xl border border-border bg-surface p-[18px] transition-all hover:-translate-y-px hover:border-primary hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium text-text-2">{label}</div>
        {Icon && (
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
              ICON_TONE[iconTone],
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[30px] font-extrabold leading-none tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
        {hasTrend && (
          <span
            className={cn(
              'flex items-center gap-1 font-semibold',
              up ? 'text-emerald' : 'text-danger',
            )}
          >
            {up ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {up ? '+' : ''}
            {trend}%
          </span>
        )}
        {hasTrend && trendSuffix && (
          <span className="text-text-3">{trendSuffix}</span>
        )}
        {!hasTrend && hint && <span className="text-text-3">{hint}</span>}
      </div>
    </div>
  )
}
