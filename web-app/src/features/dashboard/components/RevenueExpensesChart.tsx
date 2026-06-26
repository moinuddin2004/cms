import { memo } from 'react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'

export interface RevenueTrendPoint {
  month: string
  revenue: number
  expenses: number
}

interface Props {
  data: RevenueTrendPoint[]
}

function compactCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`
  return String(v)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const profit = (payload[0]?.value ?? 0) - (payload[1]?.value ?? 0)
  return (
    <div className="space-y-1 rounded-lg bg-foreground p-3 text-xs text-background shadow-lg">
      <p className="font-semibold">{label}</p>
      {payload.map((e) => (
        <p key={e.name} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: e.color }}
          />
          {e.name}: {formatCurrency(e.value)}
        </p>
      ))}
      <p className="border-t border-background/20 pt-1">
        Net: {formatCurrency(profit)}
      </p>
    </div>
  )
}

export const RevenueExpensesChart = memo(function RevenueExpensesChart({
  data,
}: Props) {
  const empty = data.every((d) => d.revenue === 0 && d.expenses === 0)
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[15px] font-bold">Revenue vs Expenses</div>
        <div className="flex gap-[14px] text-xs text-text-2">
          <span className="flex items-center gap-1.5">
            <span className="size-[9px] rounded-[2px] bg-primary" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-[9px] rounded-[2px] bg-emerald" />
            Expenses
          </span>
        </div>
      </div>
      <div className="h-[200px] w-full">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-text-3">
            No revenue or expense activity yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                horizontal
                vertical={false}
                stroke="var(--border-soft)"
                strokeDasharray="none"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                tickFormatter={compactCurrency}
                width={44}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#gRevenue)"
                dot={false}
                activeDot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="var(--emerald)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--emerald)', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
})
