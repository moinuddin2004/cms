import { memo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="bg-foreground text-background p-3 rounded-lg shadow-lg text-xs space-y-1">
      <p className="font-semibold">{label}</p>
      {payload.map((e) => (
        <p key={e.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: e.color }}
          />
          {e.name}: {formatCurrency(e.value)}
        </p>
      ))}
      <p className="pt-1 border-t border-background/20">
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">
          Revenue vs Expenses
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            last {data.length} months
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[260px] w-full">
          {empty ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No revenue or expense activity yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={4} barCategoryGap="20%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickFormatter={compactCurrency}
                  width={44}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
