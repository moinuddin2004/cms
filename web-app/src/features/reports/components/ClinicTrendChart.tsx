import { memo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ClinicOverview } from '../types/reports.types'

type Point = ClinicOverview['trend']['points'][number]

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: Point }>
  label?: string
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const rows: Array<[string, string | number]> = [
    ['Visits', p.visits],
    ['· first visit', p.newVisits],
    ['· returning', p.returningVisits],
    ['Appointments', p.appointments],
    ['Show-up', p.showUpPct == null ? '—' : `${p.showUpPct}%`],
    ['Avg wait', p.avgWaitMin == null ? '—' : `${p.avgWaitMin} min`],
  ]
  return (
    <div className="min-w-[160px] space-y-1 rounded-lg bg-foreground p-3 text-xs text-background shadow-lg">
      <p className="font-semibold">{label}</p>
      {rows.map(([k, v]) => (
        <p key={k} className="flex justify-between gap-4">
          <span className="opacity-80">{k}</span>
          <span className="tabular-nums">{v}</span>
        </p>
      ))}
    </div>
  )
}

/** Visits per bucket, split into returning (solid) and first visits (light). */
export const ClinicTrendChart = memo(function ClinicTrendChart({
  data,
}: {
  data: Point[]
}) {
  if (data.every((d) => !d.visits)) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-text-3">
        No visits in this period.
      </div>
    )
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-text-2">
        <span className="flex items-center gap-1.5">
          <span className="size-[9px] rounded-[2px] bg-primary" />
          Returning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-[9px] rounded-[2px] bg-primary/40" />
          First visit
        </span>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border-soft)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-3)' }}
              minTickGap={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'var(--text-3)' }}
              width={28}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ fill: 'var(--panel)' }}
            />
            <Bar
              dataKey="returningVisits"
              stackId="v"
              fill="var(--primary)"
              maxBarSize={36}
            />
            <Bar
              dataKey="newVisits"
              stackId="v"
              fill="var(--primary)"
              fillOpacity={0.4}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
})
