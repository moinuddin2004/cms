import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Users, CalendarDays, DollarSign, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/store/useAuthStore'
import { useQueryClient } from '@tanstack/react-query'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import {
  useMonthlySummary,
  useRevenueTrend,
} from '@/features/billing/hooks/useFinancialSummary'
import {
  usePatientCount,
  useAppointmentStats,
  useInvoiceStats,
  useTodayAppointments,
} from '@/features/dashboard/hooks/useAnalytics'
import { RevenueExpensesChart } from '@/features/dashboard/components/RevenueExpensesChart'
import { AppointmentStatusDonut } from '@/features/dashboard/components/AppointmentStatusDonut'
import { TodayScheduleTable } from '@/features/dashboard/components/TodayScheduleTable'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const PERIODS = ['This month', 'This week', 'Today', 'Custom'] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user, activeOrganizationId, accessibleOrganizations } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [activePeriod, setActivePeriod] = useState<string>('This month')

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear()

  const activeOrg = accessibleOrganizations.find(
    (o) => o.id === activeOrganizationId,
  )

  const ranges = useMemo(() => {
    const monthStart = `${year}-${pad(month)}-01T00:00:00.000Z`
    const lastDay = new Date(year, month, 0).getDate()
    const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999Z`
    const today = new Date()
    const todayStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00:00.000Z`
    const todayEnd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T23:59:59.999Z`
    return { monthStart, monthEnd, todayStart, todayEnd }
  }, [month, year])

  const patientCount = usePatientCount()
  const invoiceStats = useInvoiceStats()
  const monthly = useMonthlySummary(month, year)
  const trend = useRevenueTrend(6)
  const todayAppts = useAppointmentStats(ranges.todayStart, ranges.todayEnd, 'today')
  const monthAppts = useAppointmentStats(ranges.monthStart, ranges.monthEnd, `month-${year}-${month}`)
  const todaySchedule = useTodayAppointments(ranges.todayStart, ranges.todayEnd, 8)

  const revenue = monthly.data?.totalRevenue ?? 0

  const revenueDelta = useMemo(() => {
    if (!isCurrentMonth || !trend.data || trend.data.length < 2) return undefined
    const arr = trend.data
    const curr = arr[arr.length - 1]?.revenue ?? 0
    const prev = arr[arr.length - 2]?.revenue ?? 0
    if (prev === 0) return undefined
    return Math.round(((curr - prev) / prev) * 100)
  }, [trend.data, isCurrentMonth])

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['financial-monthly'] })
    queryClient.invalidateQueries({ queryKey: ['financial-trend'] })
  }

  return (
    <div className="space-y-[18px]">
      {/* Greeting header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">
            {greeting()}, {user?.name || 'Administrator'}
          </h1>
          <p className="mt-1 text-[14px] text-text-2">
            Here&apos;s how {activeOrg?.name || 'your practice'} is performing today.
          </p>
        </div>
        <Button
          onClick={() => navigate({ to: '/appointments', search: { create: '1' } })}
          className="h-[38px] gap-1.5 px-4"
        >
          <Plus className="size-4" />
          New appointment
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Period segmented control */}
        <div className="flex items-center rounded-[9px] border border-border bg-surface p-[3px]">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActivePeriod(p)}
              className={`rounded-[7px] px-3 py-[5px] text-[13px] font-medium transition-colors ${
                activePeriod === p
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-2 hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Month select */}
        <Select
          value={`${MONTHS[month - 1]} ${year}`}
          onValueChange={(v) => {
            const [m, y] = v.split(' ')
            setMonth(MONTHS.indexOf(m) + 1)
            setYear(Number(y))
          }}
        >
          <SelectTrigger className="h-9 w-auto border-border bg-surface px-3 text-[13px] font-medium shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => {
              const mIdx = ((now.getMonth() - i) % 12 + 12) % 12
              const yr = now.getFullYear() - (now.getMonth() - i < 0 ? 1 : 0)
              return (
                <SelectItem key={`${mIdx}-${yr}`} value={`${MONTHS[mIdx]} ${yr}`}>
                  {MONTHS[mIdx]} {yr}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="ml-auto h-9 gap-1.5 px-3 text-text-2"
        >
          <RefreshCw className="size-[15px]" />
          Refresh
        </Button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Patients"
          value={patientCount.data?.toLocaleString() ?? '0'}
          icon={Users}
          iconTone="primary"
          trend={revenueDelta !== undefined ? 12 : undefined}
          trendSuffix="vs last month"
        />
        <StatCard
          label="Appointments Today"
          value={todayAppts.data?.total ?? 0}
          icon={CalendarDays}
          iconTone="violet"
          hint={
            <span>
              <span className="font-semibold text-emerald">
                {todayAppts.data?.completed ?? 0} completed
              </span>
              {' '}&middot; {(todayAppts.data?.total ?? 0) - (todayAppts.data?.completed ?? 0)} upcoming
            </span>
          }
        />
        <StatCard
          label={`Revenue (${MONTHS[month - 1]})`}
          value={formatCurrency(revenue)}
          icon={DollarSign}
          iconTone="emerald"
          trend={revenueDelta}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(invoiceStats.data?.outstandingAmount ?? 0)}
          icon={AlertTriangle}
          iconTone="amber"
          hint={
            <span className="font-semibold text-amber">
              {invoiceStats.data?.overdueCount ?? 0} invoices overdue
            </span>
          }
        />
      </div>

      {/* Charts: 2fr + 1fr */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <RevenueExpensesChart data={trend.data ?? []} />
        {monthAppts.data && <AppointmentStatusDonut stats={monthAppts.data} />}
      </div>

      {/* Today's Schedule */}
      <TodayScheduleTable data={todaySchedule.data?.data ?? []} />
    </div>
  )
}
