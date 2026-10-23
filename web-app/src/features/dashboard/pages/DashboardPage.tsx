import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  HandCoins,
  MapPin,
  Plus,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
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
import { useAccess } from '@/features/access/hooks/useAccess'
import { Can } from '@/features/access/components/Can'
import { KpiTile, TrendChip } from '../components/KpiTile'
import { RevenueOverviewCard } from '../components/RevenueOverviewCard'
import { VisitStatusCard } from '../components/VisitStatusCard'
import { TodayScheduleList } from '../components/TodayScheduleList'
import { TopProceduresList } from '../components/TopProceduresList'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const pad = (n: number) => String(n).padStart(2, '0')

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const {
    user,
    activeOrganizationId,
    activeLocationId,
    accessibleOrganizations,
  } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear()
  const monthLabel = `${MONTHS[month - 1]} ${year}`

  const activeOrg = accessibleOrganizations.find(
    (o) => o.id === activeOrganizationId,
  )
  const activeLocation = activeOrg?.locations.find(
    (l) => l.id === activeLocationId,
  )

  // Only ask for (and show) what this user may see: no 403 retries and no
  // misleading PKR 0 cards for roles without billing / finance.
  const { can, hasFeature } = useAccess()
  const seePatients = can('patients.view')
  const seeAppointments = can('appointments.view')
  const seeInvoices = can('billing.invoice.view')
  const seeFinance =
    can('reports.financial.view') && hasFeature('billing.financial_summary')

  const ranges = useMemo(() => {
    const lastDay = new Date(year, month, 0).getDate()
    const today = new Date()
    const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    return {
      monthStart: `${year}-${pad(month)}-01T00:00:00.000Z`,
      monthEnd: `${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999Z`,
      todayStart: `${day}T00:00:00.000Z`,
      todayEnd: `${day}T23:59:59.999Z`,
    }
  }, [month, year])

  const patientCount = usePatientCount(seePatients)
  const invoiceStats = useInvoiceStats(seeInvoices)
  const monthly = useMonthlySummary(month, year, seeFinance)
  const trend = useRevenueTrend(6, seeFinance)
  const todayAppts = useAppointmentStats(
    ranges.todayStart,
    ranges.todayEnd,
    'today',
    seeAppointments,
  )
  const monthAppts = useAppointmentStats(
    ranges.monthStart,
    ranges.monthEnd,
    `month-${year}-${month}`,
    seeAppointments,
  )
  const todaySchedule = useTodayAppointments(
    ranges.todayStart,
    ranges.todayEnd,
    8,
    seeAppointments,
  )

  const fetchingDashboard = useIsFetching({ queryKey: ['dashboard'] })
  const fetchingMonthly = useIsFetching({ queryKey: ['financial-monthly'] })
  const fetchingTrend = useIsFetching({ queryKey: ['financial-trend'] })
  const refreshing = fetchingDashboard + fetchingMonthly + fetchingTrend > 0

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['financial-monthly'] })
    void queryClient.invalidateQueries({ queryKey: ['financial-trend'] })
  }

  // Month-over-month change from the trend (last two points = this and last month).
  const revenueDelta = useMemo(() => {
    const arr = trend.data
    if (!isCurrentMonth || !arr || arr.length < 2) return undefined
    const curr = arr[arr.length - 1]?.revenue ?? 0
    const prev = arr[arr.length - 2]?.revenue ?? 0
    if (prev === 0) return undefined
    return Math.round(((curr - prev) / prev) * 100)
  }, [trend.data, isCurrentMonth])

  const today = todayAppts.data
  const todayTotal = today?.total ?? 0
  const todayDone = today?.completed ?? 0
  const todayInClinic = (today?.waiting ?? 0) + (today?.inProgress ?? 0)
  const paidInvoices = monthly.data?.paidInvoiceCount ?? 0
  const overdue = invoiceStats.data?.overdueCount ?? 0

  const tiles = [
    seePatients && (
      <KpiTile
        key="patients"
        label="Active patients"
        value={(patientCount.data ?? 0).toLocaleString()}
        icon={Users}
        tone="primary"
        to="/patients"
        isLoading={patientCount.isLoading}
        footer="Registered and active in this clinic"
      />
    ),
    seeAppointments && (
      <KpiTile
        key="today"
        label="Visits today"
        value={todayTotal}
        icon={CalendarDays}
        tone="violet"
        to="/appointments"
        isLoading={todayAppts.isLoading}
        footer={
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full bg-emerald transition-all"
                style={{
                  width: `${todayTotal ? (todayDone / todayTotal) * 100 : 0}%`,
                }}
              />
            </div>
            <span>
              <b className="font-semibold text-emerald">{todayDone} done</b>
              {' · '}
              {todayInClinic} in clinic
            </span>
          </div>
        }
      />
    ),
    seeFinance && (
      <KpiTile
        key="revenue"
        label={`Revenue · ${MONTHS[month - 1].slice(0, 3)}`}
        value={formatCurrency(monthly.data?.totalRevenue ?? 0)}
        icon={Wallet}
        tone="emerald"
        to="/finance"
        isLoading={monthly.isLoading}
        sparkline={monthly.data?.revenueByDay.map((d) => d.amount)}
        footer={
          revenueDelta !== undefined ? (
            <TrendChip value={revenueDelta} suffix="vs last month" />
          ) : (
            `${paidInvoices} paid invoice${paidInvoices === 1 ? '' : 's'}`
          )
        }
      />
    ),
    seeInvoices && (
      <KpiTile
        key="outstanding"
        label="Outstanding"
        value={formatCurrency(invoiceStats.data?.outstandingAmount ?? 0)}
        icon={AlertTriangle}
        tone={overdue > 0 ? 'danger' : 'amber'}
        to="/invoices"
        isLoading={invoiceStats.isLoading}
        footer={
          overdue > 0 ? (
            <span className="rounded-full bg-danger-soft px-1.5 py-0.5 font-semibold text-danger">
              {overdue} overdue
            </span>
          ) : (
            'No overdue invoices'
          )
        }
      />
    ),
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-text-3">
            {now.toLocaleDateString('en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {greeting()}, {user?.name || 'there'}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-2">
            <MapPin className="size-3.5 text-text-3" />
            {activeOrg?.name || 'Your clinic'}
            {activeLocation?.name ? ` · ${activeLocation.name}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            clearable={false}
            value={monthLabel}
            onValueChange={(v) => {
              const [m, y] = v.split(' ')
              setMonth(MONTHS.indexOf(m) + 1)
              setYear(Number(y))
            }}
          >
            <SelectTrigger className="h-9 w-auto gap-2 bg-surface text-sm font-medium shadow-none">
              <CalendarDays className="size-4 text-text-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const value = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
                return (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <TooltipButton
            tooltip="Refresh"
            variant="outline"
            size="icon"
            className="size-9"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
          </TooltipButton>
          <Can perm="billing.desk.use">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => navigate({ to: '/billing' })}
            >
              <HandCoins className="size-4" />
              Collect payment
            </Button>
          </Can>
          <Can perm="appointments.book">
            <Button
              className="h-9"
              onClick={() =>
                navigate({ to: '/appointments', search: { create: '1' } })
              }
            >
              <Plus className="size-4" />
              New appointment
            </Button>
          </Can>
        </div>
      </header>

      {/* KPIs */}
      {tiles.length > 0 && (
        <div
          className={cn(
            'grid grid-cols-1 gap-4 sm:grid-cols-2',
            tiles.length >= 4 && 'xl:grid-cols-4',
            tiles.length === 3 && 'xl:grid-cols-3',
          )}
        >
          {tiles}
        </div>
      )}

      {/* Money + visits */}
      {(seeFinance || seeAppointments) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {seeFinance && (
            <div
              className={cn(
                seeAppointments ? 'lg:col-span-2' : 'lg:col-span-3',
              )}
            >
              <RevenueOverviewCard
                trend={trend.data ?? []}
                monthly={monthly.data}
                monthLabel={monthLabel}
                isLoading={trend.isLoading || monthly.isLoading}
              />
            </div>
          )}
          {seeAppointments && (
            <VisitStatusCard
              stats={monthAppts.data}
              periodLabel={monthLabel}
              isLoading={monthAppts.isLoading}
            />
          )}
        </div>
      )}

      {/* Today + procedures */}
      {(seeAppointments || seeFinance) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {seeAppointments && (
            <div className={cn(seeFinance ? 'lg:col-span-2' : 'lg:col-span-3')}>
              <TodayScheduleList
                data={todaySchedule.data?.data ?? []}
                isLoading={todaySchedule.isLoading}
              />
            </div>
          )}
          {seeFinance && (
            <TopProceduresList
              procedures={monthly.data?.topProcedures}
              monthLabel={monthLabel}
              isLoading={monthly.isLoading}
            />
          )}
        </div>
      )}
    </div>
  )
}
