import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  Users,
  CalendarDays,
  DollarSign,
  Wallet,
  PiggyBank,
  AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'
import {
  useMonthlySummary,
  useRevenueTrend,
} from '@/features/billing/hooks/useFinancialSummary'
import {
  usePatientCount,
  useStaffCount,
  useAppointmentStats,
  useInvoiceStats,
  useTodayAppointments,
} from '@/features/dashboard/hooks/useAnalytics'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import { RevenueExpensesChart } from '@/features/dashboard/components/RevenueExpensesChart'
import { ExpenseCategoryChart } from '@/features/dashboard/components/ExpenseCategoryChart'
import { AppointmentStatusCard } from '@/features/dashboard/components/AppointmentStatusCard'
import { TopProceduresCard } from '@/features/dashboard/components/TopProceduresCard'
import { RecentAppointmentsCard } from '@/features/dashboard/components/RecentAppointmentsCard'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function DashboardComponent() {
  const { accessToken, user, activeLocationId } = useAuthStore()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear()

  // ── Date windows ──────────────────────────────────────────────
  const ranges = useMemo(() => {
    const monthStart = `${year}-${pad(month)}-01T00:00:00.000Z`
    const lastDay = new Date(year, month, 0).getDate()
    const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999Z`
    const today = new Date()
    const todayStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00:00.000Z`
    const todayEnd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T23:59:59.999Z`
    return { monthStart, monthEnd, todayStart, todayEnd }
  }, [month, year])

  // ── Data ──────────────────────────────────────────────────────
  const patientCount = usePatientCount()
  const staffCount = useStaffCount()
  const invoiceStats = useInvoiceStats()
  const monthly = useMonthlySummary(month, year)
  const trend = useRevenueTrend(6)
  const monthAppts = useAppointmentStats(
    ranges.monthStart,
    ranges.monthEnd,
    `month-${year}-${month}`,
  )
  const todayAppts = useAppointmentStats(
    ranges.todayStart,
    ranges.todayEnd,
    'today',
  )
  const todaySchedule = useTodayAppointments(
    ranges.todayStart,
    ranges.todayEnd,
    8,
  )

  // ── Derived metrics ───────────────────────────────────────────
  const revenue = monthly.data?.totalRevenue ?? 0
  const netProfit = monthly.data?.netProfit ?? 0
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0

  const revenueDelta = useMemo(() => {
    if (!isCurrentMonth || !trend.data || trend.data.length < 2) return null
    const arr = trend.data
    const curr = arr[arr.length - 1]?.revenue ?? 0
    const prev = arr[arr.length - 2]?.revenue ?? 0
    if (prev === 0) return null
    return ((curr - prev) / prev) * 100
  }, [trend.data, isCurrentMonth])

  if (!accessToken) {
    return <Navigate to="/login" />
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name || 'Administrator'}. Here&apos;s how your
              practice is performing.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 shadow-sm">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-8 w-[130px] border-0 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-border" />
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-8 w-[80px] border-0 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(
                  (y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!activeLocationId && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Select a location to view live practice analytics.
            </CardContent>
          </Card>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            title="Total Patients"
            value={String(patientCount.data ?? 0)}
            icon={Users}
            accent="bg-blue-50 text-blue-600"
            subLabel="Active"
            loading={patientCount.isLoading}
          />
          <KpiCard
            title="Appointments Today"
            value={String(todayAppts.data?.total ?? 0)}
            icon={CalendarDays}
            accent="bg-purple-50 text-purple-600"
            subLabel={`${todayAppts.data?.completed ?? 0} completed`}
            loading={todayAppts.isLoading}
          />
          <KpiCard
            title="Revenue"
            value={formatCurrency(revenue)}
            icon={DollarSign}
            accent="bg-green-50 text-green-600"
            subLabel={MONTHS[month - 1]}
            delta={revenueDelta}
            loading={monthly.isLoading}
          />
          <KpiCard
            title="Net Profit"
            value={formatCurrency(netProfit)}
            icon={PiggyBank}
            accent={
              netProfit >= 0
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-600'
            }
            subLabel={`${margin.toFixed(0)}% margin`}
            loading={monthly.isLoading}
          />
          <KpiCard
            title="Outstanding"
            value={formatCurrency(invoiceStats.data?.outstandingAmount ?? 0)}
            icon={AlertTriangle}
            accent="bg-amber-50 text-amber-600"
            subLabel={`${invoiceStats.data?.overdueCount ?? 0} overdue`}
            loading={invoiceStats.isLoading}
          />
          <KpiCard
            title="Active Staff"
            value={String(staffCount.data ?? 0)}
            icon={Wallet}
            accent="bg-orange-50 text-orange-600"
            subLabel="On payroll"
            loading={staffCount.isLoading}
          />
        </div>

        {/* Financial charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueExpensesChart data={trend.data ?? []} />
          </div>
          <div>
            <ExpenseCategoryChart
              data={monthly.data?.expensesByCategory ?? []}
            />
          </div>
        </div>

        {/* Operations */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            {monthAppts.data && (
              <AppointmentStatusCard
                stats={monthAppts.data}
                periodLabel={MONTHS[month - 1]}
              />
            )}
          </div>
          <div className="lg:col-span-2">
            <TopProceduresCard data={monthly.data?.topProcedures ?? []} />
          </div>
        </div>

        {/* Today's schedule */}
        <RecentAppointmentsCard data={todaySchedule.data?.data ?? []} />
      </div>
    </DashboardLayout>
  )
}
