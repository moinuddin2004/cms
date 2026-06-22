import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AppointmentStats } from '@/features/appointments/types'

interface Props {
  stats: AppointmentStats
  /** Label for the period covered, e.g. "This month". */
  periodLabel?: string
}

const SEGMENTS: Array<{
  key: keyof AppointmentStats
  label: string
  color: string
}> = [
  { key: 'completed', label: 'Completed', color: '#22c55e' },
  { key: 'scheduled', label: 'Scheduled', color: '#3b82f6' },
  { key: 'inProgress', label: 'In Progress', color: '#f59e0b' },
  { key: 'noShow', label: 'No Show', color: '#6b7280' },
  { key: 'cancelled', label: 'Cancelled', color: '#ef4444' },
]

export const AppointmentStatusCard = memo(function AppointmentStatusCard({
  stats,
  periodLabel = 'This month',
}: Props) {
  const total = stats.total || 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Appointments
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {periodLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold">{total}</span>
          <span className="text-sm text-muted-foreground">total booked</span>
        </div>

        {/* Completion / no-show rates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-status-success/10 p-3">
            <p className="text-xs text-muted-foreground">Completion rate</p>
            <p className="text-xl font-bold text-status-success">
              {stats.completionRate}%
            </p>
          </div>
          <div className="rounded-lg bg-status-error/10 p-3">
            <p className="text-xs text-muted-foreground">No-show rate</p>
            <p className="text-xl font-bold text-status-error">
              {stats.noShowRate}%
            </p>
          </div>
        </div>

        {/* Segmented bar */}
        {total > 0 && (
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted">
            {SEGMENTS.map((s) => {
              const v = (stats[s.key] as number) || 0
              if (v === 0) return null
              return (
                <div
                  key={s.key}
                  className="h-full"
                  style={{
                    width: `${(v / total) * 100}%`,
                    backgroundColor: s.color,
                  }}
                  title={`${s.label}: ${v}`}
                />
              )
            })}
          </div>
        )}

        {/* Legend */}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground flex-1">{s.label}</span>
              <span className="font-medium tabular-nums">
                {(stats[s.key] as number) || 0}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
})
