import { memo } from 'react'
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string
  icon: LucideIcon
  /** Tailwind classes for the icon chip, e.g. "bg-primary/10 text-primary" */
  accent?: string
  subLabel?: string
  /** Period-over-period change. Omit to hide the trend chip. */
  delta?: number | null
  loading?: boolean
}

export const KpiCard = memo(function KpiCard({
  title,
  value,
  icon: Icon,
  accent = 'bg-muted text-muted-foreground',
  subLabel,
  delta,
  loading,
}: KpiCardProps) {
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta)
  const up = (delta ?? 0) >= 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={cn('p-2.5 rounded-lg flex-shrink-0', accent)}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            {loading ? (
              <div className="h-8 w-24 mt-1 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-foreground mt-1 truncate">
                {value}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {subLabel && (
                <span className="text-xs text-muted-foreground">{subLabel}</span>
              )}
              {hasDelta && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded',
                    up
                      ? 'text-status-success bg-status-success/10'
                      : 'text-status-error bg-status-error/10',
                  )}
                >
                  {up ? '+' : ''}
                  {delta!.toFixed(1)}%
                  {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
