import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Pagination,
} from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DatePicker } from '@/components/shared/DatePicker'
import { formatPaisa } from '@/features/lab-catalog'
import {
  ALL,
  LabFilter,
  PayablesNav,
  useClinicLabs,
} from '../components/PayablesNav'
import {
  useAgingReport,
  useCaseProfitReport,
  useMonthlyCostReport,
} from '../hooks/useLabPayables'
import { AGING_LABEL } from '../types'
import type { AgingBucket } from '../types'

const BUCKETS = Object.keys(AGING_LABEL) as AgingBucket[]
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const money = (p: number) => (
  <span className="tabular-nums">{p ? formatPaisa(p) : '—'}</span>
)
const th = 'px-3 py-2 text-left text-xs font-medium text-text-3'
const td = 'px-3 py-2'

/** Payables reports (lab ERD §15): what is owed by age, lab cost per month, case profit. */
export function PayablesReportsPage() {
  const [tab, setTab] = useState('aging')
  return (
    <DashboardLayout
      title="Lab payables"
      subtitle="Owed to labs, lab cost per month and profit per case."
    >
      <div className="space-y-4">
        <PayablesNav active="/lab-payables/reports" />
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="aging">Payables aging</TabsTrigger>
            <TabsTrigger value="monthly">Lab cost by month</TabsTrigger>
            <TabsTrigger value="profit">Case profit</TabsTrigger>
          </TabsList>
          <TabsContent value="aging">
            <Aging />
          </TabsContent>
          <TabsContent value="monthly">
            <Monthly />
          </TabsContent>
          <TabsContent value="profit">
            <CaseProfit />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

function Aging() {
  const { data, isLoading, isError, refetch } = useAgingReport()
  if (isLoading) return <LoadingSkeleton variant="table" />
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />
  if (!data.labs.length)
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing owed to labs"
        description="Approved bills with a balance show up here by how overdue they are."
      />
    )
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <p className="px-3 pt-3 text-sm text-text-3">
        As of {data.asOf} (by due date)
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={th}>Lab</th>
            {BUCKETS.map((b) => (
              <th key={b} className={`${th} text-right`}>
                {AGING_LABEL[b]}
              </th>
            ))}
            <th className={`${th} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.labs.map((l) => (
            <tr
              key={l.labId}
              className="border-t border-border/60 transition-colors hover:bg-muted/40"
            >
              <td className={td}>
                {l.labName}{' '}
                <span className="text-xs text-text-3">({l.bills})</span>
              </td>
              {BUCKETS.map((b) => (
                <td key={b} className={`${td} text-right`}>
                  {money(l.buckets[b])}
                </td>
              ))}
              <td className={`${td} text-right font-semibold`}>
                {money(l.totalPaisa)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border font-semibold">
          <tr>
            <td className={td}>All labs</td>
            {BUCKETS.map((b) => (
              <td key={b} className={`${td} text-right`}>
                {money(data.totals.buckets[b])}
              </td>
            ))}
            <td className={`${td} text-right`}>
              {money(data.totals.totalPaisa)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Monthly() {
  const [year, setYear] = useState(new Date().getFullYear())
  const { data, isLoading, isError, refetch } = useMonthlyCostReport(year)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-3">Year</span>
        <Input
          aria-label="Year"
          type="number"
          className="h-9 w-28"
          value={year}
          onChange={(e) => {
            const y = Number(e.target.value)
            if (y >= 2000 && y <= 2100) setYear(y)
          }}
        />
      </div>
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data.labs.length ? (
        <EmptyState
          icon={BarChart3}
          title={`No approved lab cost in ${year}`}
          description="Approved vendor bills are counted in the month of their bill date."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Lab</th>
                {MONTHS.map((m) => (
                  <th key={m} className={`${th} text-right`}>
                    {m}
                  </th>
                ))}
                <th className={`${th} text-right`}>Year</th>
              </tr>
            </thead>
            <tbody>
              {data.labs.map((l) => (
                <tr
                  key={l.labId}
                  className="border-t border-border/60 transition-colors hover:bg-muted/40"
                >
                  <td className={td}>{l.labName}</td>
                  {l.months.map((v, i) => (
                    <td key={i} className={`${td} text-right`}>
                      {money(v)}
                    </td>
                  ))}
                  <td className={`${td} text-right font-semibold`}>
                    {money(l.totalPaisa)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border font-semibold">
              <tr>
                <td className={td}>All labs</td>
                {data.totals.months.map((v, i) => (
                  <td key={i} className={`${td} text-right`}>
                    {money(v)}
                  </td>
                ))}
                <td className={`${td} text-right`}>
                  {money(data.totals.totalPaisa)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function CaseProfit() {
  const labs = useClinicLabs()
  const [labId, setLabId] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const { data, isLoading, isError, refetch } = useCaseProfitReport({
    page,
    limit,
    labId: labId === ALL ? undefined : labId,
    from: from || undefined,
    to: to || undefined,
  })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <LabFilter
          value={labId}
          labs={labs}
          onChange={(v) => {
            setLabId(v)
            setPage(1)
          }}
        />
        <DatePicker
          value={from || undefined}
          onChange={(v) => {
            setFrom(v)
            setPage(1)
          }}
          placeholder="From"
          clearable
          className="h-9 w-36"
        />
        <DatePicker
          value={to || undefined}
          onChange={(v) => {
            setTo(v)
            setPage(1)
          }}
          placeholder="To"
          clearable
          className="h-9 w-36"
        />
      </div>
      <p className="text-xs text-text-3">
        Patient price − lab cost − case expenses, from the prices fixed on each
        order. Doctor commission on lab cases is not included yet.
      </p>
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data.data.length ? (
        <EmptyState
          icon={BarChart3}
          title="No lab cases"
          description="Submitted lab orders show their profit here."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Patient</th>
                  <th className={th}>Lab</th>
                  <th className={`${th} text-right`}>Patient price</th>
                  <th className={`${th} text-right`}>Lab cost</th>
                  <th className={`${th} text-right`}>Billed by lab</th>
                  <th className={`${th} text-right`}>Expenses</th>
                  <th className={`${th} text-right`}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr
                    key={r.orderId}
                    className="border-t border-border/60 transition-colors hover:bg-muted/40"
                  >
                    <td className={td}>{r.orderNo}</td>
                    <td className={td}>{r.patientName ?? '—'}</td>
                    <td className={td}>{r.labName}</td>
                    <td className={`${td} text-right`}>
                      {money(r.patientPricePaisa)}
                    </td>
                    <td className={`${td} text-right`}>
                      {money(r.labCostPaisa)}
                    </td>
                    <td className={`${td} text-right text-text-3`}>
                      {money(r.billedLabCostPaisa)}
                    </td>
                    <td className={`${td} text-right`}>
                      {money(r.expensesPaisa)}
                    </td>
                    <td
                      className={`${td} text-right font-semibold ${r.profitPaisa < 0 ? 'text-red-500' : ''}`}
                    >
                      {formatPaisa(r.profitPaisa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={Math.max(1, data.totalPages)}
            limit={limit}
            total={data.total}
            onPageChange={setPage}
            onLimitChange={(s) => {
              setLimit(s)
              setPage(1)
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </>
      )}
    </div>
  )
}
