import { memo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { compactMoney } from '../lib/report-format'
import type { FinanceOverview } from '../types/reports.types'

type Point = FinanceOverview['trend'][number]

const SERIES = [
  { key: 'revenue', label: 'Revenue', color: 'var(--primary)' },
  { key: 'costs', label: 'Costs', color: 'var(--text-3)' },
  { key: 'profit', label: 'Net profit', color: 'var(--emerald)' },
] as const

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
  return (
    <div className="space-y-1 rounded-lg bg-foreground p-3 text-xs text-background shadow-lg">
      <p className="font-semibold">{label}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
          <span className="tabular-nums">{formatCurrency(p[s.key])}</span>
        </p>
      ))}
    </div>
  )
}

/** 12 months: revenue and cost bars with the net-profit line. */
export const FinanceTrendChart = memo(function FinanceTrendChart({
  data,
}: {
  data: Point[]
}) {
  const empty = data.every((d) => d.revenue === 0 && d.costs === 0)
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-text-2">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className="size-[9px] rounded-[2px]"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
      <div className="h-[260px] w-full">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-text-3">
            No revenue or costs in the last 12 months.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--border-soft)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                tickFormatter={compactMoney}
                width={48}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ fill: 'var(--panel)' }}
              />
              <Bar
                dataKey="revenue"
                name="Revenue"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
              <Bar
                dataKey="costs"
                name="Costs"
                fill="var(--text-3)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="Net profit"
                stroke="var(--emerald)"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: 'var(--emerald)', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
})
