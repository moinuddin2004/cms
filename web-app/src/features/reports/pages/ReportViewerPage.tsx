import { useMemo, useState } from 'react'
import { AlertTriangle, FileSearch, Info } from 'lucide-react'
import { BackButton } from '@/components/shared/BackButton'
import { usePageTitle } from '@/hooks/useBackNavigation'
import { EmptyState, ErrorState } from '@/components/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Skeleton } from '@/components/ui/skeleton'
import { useDoctors } from '@/features/appointments'
import { StatsStrip } from '@/features/billing'
import type { StatItem } from '@/features/billing'
import { ExportMenu } from '../components/ExportMenu'
import { PnlStatementRows } from '../components/PnlStatement'
import { ReportFilters } from '../components/ReportFilters'
import { ReportTable } from '../components/ReportTable'
import {
  useReport,
  useReportCatalog,
  useReportQuery,
} from '../hooks/use-reports'
import { CATEGORY_META } from '../lib/report-categories'
import { formatReportValue, periodLabel } from '../lib/report-format'
import type {
  ReportCategory,
  ReportQuery,
  ReportView,
} from '../types/reports.types'

const EXPENSE_CATEGORIES = [
  ['RENT', 'Rent'],
  ['UTILITIES', 'Utilities'],
  ['SUPPLIES', 'Supplies'],
  ['SALARY', 'Salary'],
  ['EQUIPMENT', 'Equipment'],
  ['MARKETING', 'Marketing'],
  ['MAINTENANCE', 'Maintenance'],
  ['OTHER', 'Other'],
] as const

const headline = (key: string) => (key === 'total' || key === 'net' ? 1 : 0)

/** Summary tiles: the report's own summary, else its money / count totals. */
function summaryItems(
  view: ReportView,
  category: ReportCategory = 'revenue',
): StatItem[] {
  const meta = CATEGORY_META[category]
  const [color, bg] = [meta.tone.split(' ')[1], meta.tone.split(' ')[0]]
  const items = view.summary.length
    ? view.summary.map((s) => ({
        label: s.label,
        value: formatReportValue(s.value, s.type),
      }))
    : view.columns
        .filter((c) => c.total && view.totals?.[c.key] != null)
        // the bottom-line columns (total / net) first, then left to right
        .sort((a, b) => headline(b.key) - headline(a.key))
        .slice(0, 5)
        .map((c) => ({
          label: `Total ${c.header.toLowerCase()}`,
          value: formatReportValue(view.totals?.[c.key], c.type),
        }))
  return [
    { label: 'Rows', value: view.rows.length.toLocaleString('en-PK') },
    ...items,
  ]
    .slice(0, 6)
    .map((x, i) => ({
      key: `${i}`,
      label: x.label,
      value: x.value,
      icon: i === 0 ? FileSearch : meta.icon,
      color,
      bg,
    }))
}

/** One report on screen with its filters, totals and Excel / PDF download. */
export function ReportViewerPage({ reportKey }: { reportKey: string }) {
  const catalog = useReportCatalog()
  const item = catalog.data?.find((r) => r.key === reportKey)
  const shared = useReportQuery(item?.permission)
  const [doctorId, setDoctorId] = useState('all')
  const [category, setCategory] = useState('all')
  const doctors = useDoctors()

  const filters = item?.filters
  const query = useMemo<ReportQuery>(
    () => ({
      ...(filters?.dates === 'asOf' ? { scope: shared.scope } : shared),
      basis: filters?.basis ? shared.basis : undefined,
      doctorId: filters?.doctor && doctorId !== 'all' ? doctorId : undefined,
      category:
        filters?.expenseCategory && category !== 'all' ? category : undefined,
    }),
    [shared, filters, doctorId, category],
  )
  const isPnl = reportKey === 'profit-loss'
  // Wait for the catalog: the filters (dates / basis) depend on the report.
  const report = useReport(reportKey, query, !!item)
  usePageTitle(item?.title)
  const view = report.data
  const activeFilters = (query.doctorId ? 1 : 0) + (query.category ? 1 : 0)

  if (catalog.isSuccess && !item) {
    return (
      <EmptyState
        icon={FileSearch}
        title="Report not found"
        description="This report doesn't exist or isn't available to you."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <BackButton to="/reports" label="Back to reports" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {item?.title ?? <Skeleton className="h-6 w-48" />}
            </h1>
            <p className="text-xs text-text-3">
              {item?.description}
              {view && (
                <>
                  {' · '}
                  {view.meta.scopeLabel} ·{' '}
                  {view.meta.asOf
                    ? `as of ${periodLabel(view.meta.to, view.meta.to)}`
                    : periodLabel(view.meta.from, view.meta.to)}
                </>
              )}
            </p>
          </div>
        </div>
        <ExportMenu reportKey={reportKey} query={query} variant="default" />
      </div>

      <ReportFilters
        reach={item?.permission}
        dates={filters?.dates !== 'asOf'}
        basis={!!filters?.basis}
        fetching={report.isFetching && !report.isLoading}
        extra={
          <>
            {filters?.doctor && (
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs">
                  <SelectValue placeholder="All doctors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All doctors</SelectItem>
                  {(doctors.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Dr. {d.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filters?.expenseCategory && (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {activeFilters > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-primary-text hover:underline"
                onClick={() => {
                  setDoctorId('all')
                  setCategory('all')
                }}
              >
                Clear filters ({activeFilters})
              </button>
            )}
          </>
        }
      />

      {report.isError ? (
        <ErrorState
          title="Couldn't load this report"
          onRetry={() => void report.refetch()}
        />
      ) : !view ? (
        <div className="space-y-4">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
      ) : (
        <>
          <StatsStrip items={summaryItems(view, item?.category)} />

          {view.truncated && (
            <p className="flex items-center gap-2 rounded-lg border border-amber/30 bg-amber-soft px-3 py-2 text-sm text-amber">
              <AlertTriangle className="size-4 shrink-0" />
              Showing the first {view.rows.length.toLocaleString('en-PK')} rows.
              Download Excel for up to 50,000, or pick a shorter period.
            </p>
          )}

          {isPnl ? (
            <div className="max-w-3xl rounded-xl border border-border bg-surface p-5">
              <PnlStatementRows rows={view.rows} />
            </div>
          ) : view.rows.length === 0 && activeFilters > 0 ? (
            <EmptyState
              icon={FileSearch}
              title="No results for your filters"
              description="Try another doctor or category, or clear the filters."
            />
          ) : (
            <ReportTable
              columns={view.columns}
              rows={view.rows}
              emptyMessage={
                view.meta.asOf
                  ? 'Nothing to show right now.'
                  : 'No records in this period.'
              }
            />
          )}

          {view.notes.length > 0 && (
            <div className="space-y-1 text-xs text-text-3">
              {view.notes.map((n) => (
                <p key={n} className="flex items-start gap-1.5">
                  <Info className="mt-px size-3.5 shrink-0" />
                  {n}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
