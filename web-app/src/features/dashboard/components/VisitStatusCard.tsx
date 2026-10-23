import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { AppointmentStats } from '@/features/appointments/types'

interface Props {
  stats: AppointmentStats | undefined
  periodLabel: string
  isLoading?: boolean
}

const SEGMENTS = [
  { key: 'completed', label: 'Completed', color: 'var(--emerald)' },
  { key: 'upcoming', label: 'Upcoming', color: 'var(--primary)' },
  { key: 'inClinic', label: 'In clinic', color: 'var(--amber)' },
  { key: 'noShow', label: 'No-show', color: 'var(--danger)' },
  { key: 'cancelled', label: 'Cancelled', color: 'var(--text-3)' },
] as const

/**
 * Visits by status for the period. The centre shows the sum of the segments
 * (the queue's waiting / in-consultation counts include walk-ins, so the API's
 * `total` alone would not add up).
 */
export function VisitStatusCard({ stats, periodLabel, isLoading }: Props) {
  const values: Record<(typeof SEGMENTS)[number]['key'], number> = {
    completed: stats?.completed ?? 0,
    upcoming: stats?.scheduled ?? 0,
    inClinic: (stats?.waiting ?? 0) + (stats?.inProgress ?? 0),
    noShow: stats?.noShow ?? 0,
    cancelled: stats?.cancelled ?? 0,
  }
  const total = Object.values(values).reduce((a, b) => a + b, 0)
  const data = SEGMENTS.map((s) => ({ ...s, value: values[s.key] }))
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">Visits</h2>
      <p className="text-sm text-text-3">{periodLabel}</p>

      {isLoading ? (
        <div className="mx-auto mt-6 size-40 animate-pulse rounded-full bg-panel" />
      ) : (
        <div className="relative mx-auto mt-4 size-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={total ? data : [{ key: 'none', value: 1 }]}
                dataKey="value"
                innerRadius="72%"
                outerRadius="100%"
                paddingAngle={total ? 2 : 0}
                cornerRadius={4}
                stroke="none"
                isAnimationActive={false}
              >
                {(total
                  ? data
                  : [{ key: 'none', color: 'var(--panel-2)' }]
                ).map((d) => (
                  <Cell key={d.key} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums">{total}</span>
            <span className="text-xs text-text-3">visits</span>
          </div>
        </div>
      )}

      <ul className="mt-5 space-y-2.5 text-sm">
        {data.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-text-2">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums">
              {s.value}
            </span>
            <span className="w-10 text-right text-xs text-text-3 tabular-nums">
              {pct(s.value)}%
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <div className="text-xs text-text-3">Completion rate</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">
            {Math.round(stats?.completionRate ?? 0)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-text-3">Avg. wait</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">
            {stats?.avgWaitMinutes != null
              ? `${Math.round(stats.avgWaitMinutes)} min`
              : '—'}
          </div>
        </div>
      </div>
    </section>
  )
}
