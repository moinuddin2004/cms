import { FileBarChart, FlaskConical, HandCoins, Wallet } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState, PageWrapper } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import {
  AttentionList,
  BarList,
  DashCard,
  KpiTile,
  StackedBar,
  percentChange,
} from '../components/finance-cards'
import type { AttentionItem, Tone } from '../components/finance-cards'
import { ExportMenu } from '../components/ExportMenu'
import { FinanceTrendChart } from '../components/FinanceTrendChart'
import { PnlStatement } from '../components/PnlStatement'
import { ReportFilters } from '../components/ReportFilters'
import { useFinanceOverview, useReportQuery } from '../hooks/use-reports'
import { compactMoney, periodLabel } from '../lib/report-format'
import type { FinanceOverview } from '../types/reports.types'
import { activeCurrency } from '@/lib/currency'

/** Older balances are worse: fresh → green, 90+ days → red. */
const AGING_TONE: Tone[] = ['emerald', 'primary', 'amber', 'danger', 'danger']
const ACCOUNT_TONE: Tone[] = ['primary', 'violet', 'emerald', 'neutral']

const pkr = (n: number) => `${activeCurrency()} ${compactMoney(n)}`

/**
 * The owner's money screen: is the clinic making a profit, where revenue
 * comes from, where it goes, and what needs chasing — for any period, one
 * location or all of them.
 */
export function FinanceDashboardPage() {
  const query = useReportQuery()
  const overview = useFinanceOverview(query)
  const d = overview.data

  return (
    <div className="space-y-4">
      <PageWrapper
        title="Finance overview"
        subtitle={
          d
            ? `${d.scope.label} · ${periodLabel(d.period.from, d.period.to)} · compared with ${periodLabel(d.previousPeriod.from, d.previousPeriod.to)}`
            : 'Profit, loss and cash for your clinic'
        }
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu
              reportKey="profit-loss"
              query={query}
              label="Download P&L"
            />
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/reports">
                <FileBarChart className="size-4" />
                All reports
              </Link>
            </Button>
          </div>
        }
      />

      <ReportFilters
        basis
        fetching={overview.isFetching && !overview.isLoading}
      />

      {overview.isError ? (
        <ErrorState
          title="Couldn't load the finance overview"
          onRetry={() => void overview.refetch()}
        />
      ) : !d ? (
        <DashboardSkeleton />
      ) : (
        <FinanceDashboard d={d} />
      )}
    </div>
  )
}

function FinanceDashboard({ d }: { d: FinanceOverview }) {
  const { kpis, balances } = d
  const overdue = balances.aging.slice(1).reduce((a, b) => a + b.amount, 0)
  const collectedPct = kpis.billed.value
    ? Math.round((kpis.collected.value / kpis.billed.value) * 100)
    : null
  const topCost = d.costBreakdown.at(0)
  const labsDue = balances.payable - balances.payableOverdue

  const attention: AttentionItem[] = [
    {
      key: 'overdue',
      label: 'Overdue patient balances',
      value: overdue,
      display: formatCurrency(overdue),
      icon: HandCoins,
      tone: 'danger',
      report: 'outstanding',
    },
    {
      key: 'labs-overdue',
      label: 'Overdue lab bills',
      value: balances.payableOverdue,
      display: formatCurrency(balances.payableOverdue),
      icon: FlaskConical,
      tone: 'danger',
      report: 'lab-bills',
    },
    {
      key: 'labs-due',
      label: 'Lab bills to pay',
      value: labsDue,
      display: formatCurrency(labsDue),
      icon: FlaskConical,
      tone: 'amber',
      report: 'lab-bills',
    },
    {
      key: 'advances',
      label: 'Patient advances held',
      value: balances.advances,
      display: formatCurrency(balances.advances),
      icon: Wallet,
      tone: 'primary',
      report: 'collections',
    },
  ]

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label={
            d.basis === 'collected' ? 'Revenue (collected)' : 'Revenue (billed)'
          }
          value={formatCurrency(kpis.revenue.value)}
          change={percentChange(kpis.revenue.changePct)}
          hint={
            collectedPct === null
              ? undefined
              : `${collectedPct}% of ${pkr(kpis.billed.value)} billed is collected`
          }
          trend={d.trend.map((t) => t.revenue)}
        />
        <KpiTile
          label="Total costs"
          value={formatCurrency(kpis.costs.value)}
          change={percentChange(kpis.costs.changePct, false)}
          hint={topCost ? `Biggest: ${topCost.label}` : 'No costs recorded'}
          trend={d.trend.map((t) => t.costs)}
        />
        <KpiTile
          label={kpis.netProfit.value < 0 ? 'Net loss' : 'Net profit'}
          value={formatCurrency(kpis.netProfit.value)}
          change={percentChange(kpis.netProfit.changePct)}
          emphasis={kpis.netProfit.value < 0 ? 'bad' : 'good'}
          hint={
            kpis.marginPct !== null ? `${kpis.marginPct}% margin` : undefined
          }
          trend={d.trend.map((t) => t.profit)}
        />
        <KpiTile
          label="Patients owe"
          value={formatCurrency(balances.receivable)}
          hint={`${balances.openInvoices} open invoice${balances.openInvoices === 1 ? '' : 's'} · ${pkr(overdue)} overdue`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <DashCard
          title="Last 12 months"
          subtitle={`Revenue (${d.basis}), costs and net profit`}
          link={{ report: 'cash-book', label: 'Cash book' }}
        >
          <FinanceTrendChart data={d.trend} />
        </DashCard>
        <DashCard title="Needs attention" subtitle="Money to chase or pay">
          <AttentionList items={attention} notes={d.warnings} />
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashCard
          title="Profit & loss"
          subtitle={
            d.basis === 'collected'
              ? 'Revenue = money received minus refunds'
              : 'Revenue = invoices issued in the period'
          }
          link={{ report: 'profit-loss', label: 'Full statement' }}
        >
          <PnlStatement pnl={d.pnl} />
        </DashCard>
        <div className="flex flex-col gap-4">
          <DashCard
            title="Where the money goes"
            subtitle={`Costs · ${formatCurrency(d.pnl.totalCosts)}`}
            link={{ report: 'expense-summary', label: 'Expenses' }}
          >
            <BarList
              items={d.costBreakdown.map((c) => ({
                key: c.key,
                label: c.label,
                amount: c.amount,
              }))}
              tone="neutral"
              empty="No costs recorded in this period."
            />
          </DashCard>
          <DashCard title="Billing" subtitle="Invoices issued in the period">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Invoices', d.counts.invoices.toLocaleString('en-PK')],
                [
                  'Average invoice',
                  formatCurrency(Math.round(d.counts.avgInvoice)),
                ],
                [
                  'Patients billed',
                  d.counts.patientsBilled.toLocaleString('en-PK'),
                ],
                ['Discounts given', formatCurrency(d.counts.discounts)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-panel px-3 py-2">
                  <dt className="text-[11px] text-text-3">{k}</dt>
                  <dd className="font-bold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </DashCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard
          title="Revenue by doctor"
          subtitle={
            d.basis === 'collected'
              ? 'Collected on their work'
              : 'Billed on their work'
          }
          link={{ report: 'doctor-revenue', label: 'Details' }}
        >
          <BarList
            items={d.topDoctors.map((x) => ({
              key: x.doctorId ?? x.name,
              label: x.doctorId ? `Dr. ${x.name}` : x.name,
              amount: x.amount,
            }))}
            empty="No doctor revenue in this period."
          />
        </DashCard>
        <DashCard
          title="Top services"
          subtitle="Billed on issued invoices"
          link={{ report: 'service-revenue', label: 'All services' }}
        >
          <BarList
            items={d.topServices.map((s) => ({
              label: s.name,
              amount: s.amount,
              hint: `×${s.count}`,
            }))}
            empty="No services billed in this period."
          />
        </DashCard>
        <DashCard
          title="Cash and receivables"
          subtitle="Money in by account; unpaid bills by age"
          link={{ report: 'outstanding', label: 'Who owes' }}
        >
          <div className="space-y-5">
            <StackedBar
              segments={d.collectionsByAccount.map((a, i) => ({
                key: a.account,
                label: a.account,
                value: a.amount,
                tone: ACCOUNT_TONE[Math.min(i, ACCOUNT_TONE.length - 1)],
              }))}
              format={pkr}
              empty="No money received in this period."
            />
            <StackedBar
              segments={balances.aging.map((a, i) => ({
                key: a.bucket,
                label: a.bucket,
                value: a.amount,
                tone: AGING_TONE[i],
              }))}
              format={pkr}
              empty="Nobody owes anything right now."
            />
          </div>
        </DashCard>
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-[340px] rounded-xl" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    </div>
  )
}
