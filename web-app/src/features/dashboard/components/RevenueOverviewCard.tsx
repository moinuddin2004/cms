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
import { BarChart3 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type {
  MonthlySummary,
  RevenueTrendPoint,
} from '@/features/billing/types'

interface Props {
  trend: RevenueTrendPoint[]
  monthly: MonthlySummary | undefined
  monthLabel: string
  isLoading?: boolean
}

function compact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`
  return String(v)
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const revenue = payload.find((p) => p.name === 'Revenue')?.value ?? 0
  const expenses = payload.find((p) => p.name === 'Expenses')?.value ?? 0
  return (
    <div className="min-w-40 space-y-1.5 rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((e) => (
        <p key={e.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-text-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: e.color }}
            />
            {e.name}
          </span>
          <span className="font-medium tabular-nums">
            {formatCurrency(e.value)}
          </span>
        </p>
      ))}
      <p className="flex justify-between gap-4 border-t border-border pt-1.5">
        <span className="text-text-2">Net</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            revenue - expenses >= 0 ? 'text-emerald' : 'text-danger',
          )}
        >
          {formatCurrency(revenue - expenses)}
        </span>
      </p>
    </div>
  )
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-text-3">{label}</div>
      <div
        className={cn(
          'mt-1 truncate text-lg font-semibold tabular-nums',
          tone === 'positive' && 'text-emerald',
          tone === 'negative' && 'text-danger',
        )}
      >
        {value}
      </div>
    </div>
  )
}

/** Month totals on top, six-month revenue vs expenses bars below. */
export const RevenueOverviewCard = memo(function RevenueOverviewCardImpl({
  trend,
  monthly,
  monthLabel,
  isLoading,
}: Props) {
  const empty = trend.every((d) => d.revenue === 0 && d.expenses === 0)
  const net = monthly?.netProfit ?? 0

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Revenue overview</h2>
          <p className="text-sm text-text-3">
            {monthLabel} · last 6 months below
          </p>
        </div>
        <div className="flex gap-4 text-xs text-text-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber" />
            Expenses
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-panel p-4 sm:grid-cols-4">
        <Figure
          label="Revenue"
          value={formatCurrency(monthly?.totalRevenue ?? 0)}
        />
        <Figure
          label="Expenses"
          value={formatCurrency(monthly?.totalExpenses ?? 0)}
        />
        <Figure
          label="Net profit"
          value={formatCurrency(net)}
          tone={net > 0 ? 'positive' : net < 0 ? 'negative' : undefined}
        />
        <Figure
          label="Avg. invoice"
          value={formatCurrency(Math.round(monthly?.avgInvoiceValue ?? 0))}
        />
      </div>

      <div className="mt-5 h-[220px] w-full flex-1">
        {isLoading ? (
          <div className="h-full animate-pulse rounded-lg bg-panel" />
        ) : empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-text-3">
            <BarChart3 className="size-6" />
            No revenue or expenses recorded in the last 6 months.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} barGap={4} barCategoryGap="28%">
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
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
                tickFormatter={compact}
                width={40}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'var(--panel)' }}
              />
              <Bar
                dataKey="revenue"
                name="Revenue"
                fill="var(--primary)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="var(--amber)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
})
