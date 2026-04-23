import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatCard } from '@/features/dashboard/components/StatCard'
import { AnalyticsChartCard } from '@/features/dashboard/components/AnalyticsChartCard'
import { SpendingBreakdownCard } from '@/features/dashboard/components/SpendingBreakdownCard'
import { AppointmentsTable } from '@/features/dashboard/components/AppointmentsTable'
import {
  StatCardSkeleton,
  ChartCardSkeleton,
  SpendingCardSkeleton,
  TableSkeleton,
} from '@/features/dashboard/components/DashboardSkeletons'
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats'
import { useDashboardChart } from '@/features/dashboard/hooks/useDashboardChart'
import { useSpendingBreakdown } from '@/features/dashboard/hooks/useSpendingBreakdown'
import { useDashboardAppointments } from '@/features/dashboard/hooks/useDashboardAppointments'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
})

function ReportsPage() {
  const statsQuery = useDashboardStats()
  const chartQuery = useDashboardChart()
  const spendingQuery = useSpendingBreakdown()
  const appointmentsQuery = useDashboardAppointments()

  return (
    <DashboardLayout title="Report & Analytics">
      <div className="space-y-6">
        {/* Stat Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          ) : statsQuery.isError ? (
            <Card className="col-span-full">
              <CardContent className="p-6 text-center text-destructive">
                Failed to load statistics. Please try again.
              </CardContent>
            </Card>
          ) : statsQuery.data ? (
            <>
              <StatCard {...statsQuery.data.totalPatients} />
              <StatCard {...statsQuery.data.appointmentsCompleted} />
              <StatCard {...statsQuery.data.revenueGenerated} />
              <StatCard {...statsQuery.data.patientSatisfaction} />
            </>
          ) : null}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {chartQuery.isLoading ? (
              <ChartCardSkeleton />
            ) : chartQuery.isError ? (
              <Card>
                <CardContent className="p-6 text-center text-destructive">
                  Failed to load chart data.
                </CardContent>
              </Card>
            ) : chartQuery.data ? (
              <AnalyticsChartCard
                title="Statics Overview"
                data={chartQuery.data}
              />
            ) : null}
          </div>
          <div>
            {spendingQuery.isLoading ? (
              <SpendingCardSkeleton />
            ) : spendingQuery.isError ? (
              <Card>
                <CardContent className="p-6 text-center text-destructive">
                  Failed to load spending data.
                </CardContent>
              </Card>
            ) : spendingQuery.data ? (
              <SpendingBreakdownCard data={spendingQuery.data} />
            ) : null}
          </div>
        </div>

        {/* Appointments Table */}
        <Card>
          <CardContent className="p-5">
            {appointmentsQuery.isLoading ? (
              <TableSkeleton />
            ) : appointmentsQuery.isError ? (
              <div className="p-6 text-center text-destructive">
                Failed to load appointments.
              </div>
            ) : appointmentsQuery.data ? (
              <AppointmentsTable data={appointmentsQuery.data} />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
