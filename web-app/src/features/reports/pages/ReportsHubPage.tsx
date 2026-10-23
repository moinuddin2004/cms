import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  DataTable,
  EmptyState,
  ErrorState,
  NoResultsState,
  PageWrapper,
  ViewToggle,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { ReportFilters } from '../components/ReportFilters'
import { useAccess } from '@/features/access'
import {
  useReportCatalog,
  useReportExport,
  useReportQuery,
} from '../hooks/use-reports'
import { CATEGORY_META, CATEGORY_ORDER } from '../lib/report-categories'
import type {
  ReportCatalogItem,
  ReportCategory,
  ReportQuery,
} from '../types/reports.types'

/** Quick Excel / PDF buttons of one report (current period). */
function QuickDownloads({
  report,
  query,
}: {
  report: ReportCatalogItem
  query: ReportQuery
}) {
  const exporter = useReportExport()
  const { scope } = useAccess()
  if (!exporter.enabled) return null
  // "All locations" only where this report's own grant reaches the org.
  const reach =
    scope(report.permission) === 'org' ? query.scope : ('location' as const)
  const q = {
    ...query,
    scope: reach,
    basis: report.filters.basis ? query.basis : undefined,
  }
  return (
    <div className="flex items-center gap-1">
      <TooltipButton
        tooltip="Download Excel"
        size="icon"
        variant="ghost"
        className="size-8"
        disabled={exporter.isBusy(report.key)}
        onClick={() => exporter.run(report.key, q, 'xlsx')}
      >
        {exporter.isBusy(report.key, 'xlsx') ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-4 text-emerald" />
        )}
      </TooltipButton>
      <TooltipButton
        tooltip="Download PDF"
        size="icon"
        variant="ghost"
        className="size-8"
        disabled={exporter.isBusy(report.key)}
        onClick={() => exporter.run(report.key, q, 'pdf')}
      >
        {exporter.isBusy(report.key, 'pdf') ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileText className="size-4 text-danger" />
        )}
      </TooltipButton>
    </div>
  )
}

function ReportCard({
  report,
  query,
}: {
  report: ReportCatalogItem
  query: ReportQuery
}) {
  const meta = CATEGORY_META[report.category]
  const Icon = meta.icon
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-surface p-4 transition-all hover:-translate-y-px hover:border-primary hover:shadow-md">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
            meta.tone,
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{report.title}</h3>
          <p className="mt-0.5 text-xs text-text-3">{report.description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-soft pt-3">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/reports/$reportKey" params={{ reportKey: report.key }}>
            Open
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <QuickDownloads report={report} query={query} />
      </div>
    </div>
  )
}

/** Every report in one place: open on screen or download Excel / PDF. */
export function ReportsHubPage() {
  const catalog = useReportCatalog()
  const { can, scope } = useAccess()
  // The scope toggle follows whichever report grant reaches the whole org.
  const reach =
    scope('reports.financial.view') === 'org'
      ? 'reports.financial.view'
      : 'reports.clinical.view'
  const query = useReportQuery(reach)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ReportCategory | 'all'>('all')
  const [view, setView] = useState<ViewMode>('card')
  const term = useDebounce(search.trim().toLowerCase(), 300)

  const all = catalog.data ?? []
  // Only the categories this organization has reports in.
  const categories = CATEGORY_ORDER.filter((c) =>
    all.some((r) => r.category === c),
  )
  const filtered = useMemo(
    () =>
      all.filter(
        (r) =>
          (category === 'all' || r.category === category) &&
          (!term || `${r.title} ${r.description}`.toLowerCase().includes(term)),
      ),
    [all, category, term],
  )
  const activeFilters = (term ? 1 : 0) + (category !== 'all' ? 1 : 0)
  const clear = () => {
    setSearch('')
    setCategory('all')
  }

  const columns = useMemo<ColumnDef<ReportCatalogItem, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Report',
        cell: ({ row }) => (
          <Link
            to="/reports/$reportKey"
            params={{ reportKey: row.original.key }}
            className="text-sm font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: 'category',
        accessorFn: (r) => CATEGORY_META[r.category].label,
        header: 'Category',
        cell: ({ getValue }) => (
          <span className="text-sm text-text-2">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'What it shows',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-text-3">
            {row.original.description}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <QuickDownloads report={row.original} query={query} />
            <TooltipButton
              tooltip="Open report"
              size="icon"
              variant="ghost"
              className="size-8"
              asChild
            >
              <Link
                to="/reports/$reportKey"
                params={{ reportKey: row.original.key }}
              >
                <ArrowRight className="size-4" />
              </Link>
            </TooltipButton>
          </div>
        ),
      },
    ],
    [query],
  )

  return (
    <div className="space-y-4">
      <PageWrapper
        title="Reports"
        subtitle="Every report in one place — view on screen or download as Excel / PDF."
        actions={
          <div className="flex items-center gap-2">
            {can('reports.clinical.view') && (
              <Button asChild size="sm" variant="outline">
                <Link to="/clinic-overview">Clinic overview</Link>
              </Button>
            )}
            {can('finance.overview.view') && (
              <Button asChild size="sm" variant="outline">
                <Link to="/finance">Finance overview</Link>
              </Button>
            )}
          </div>
        }
      />

      <ReportFilters
        reach={reach}
        right={<ViewToggle value={view} onChange={setView} size="sm" />}
        extra={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-3" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reports"
                aria-label="Search reports"
                className="h-8 w-[200px] pl-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(['all', ...categories] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                    category === c
                      ? 'border-primary bg-primary-soft text-primary-text'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  {c === 'all' ? 'All' : CATEGORY_META[c].label}
                </button>
              ))}
            </div>
            {activeFilters > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={clear}
              >
                <X className="size-3.5" />
                Clear filters
                <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {activeFilters}
                </span>
              </Button>
            )}
          </>
        }
      />

      {catalog.isError ? (
        <ErrorState
          title="Couldn't load reports"
          onRetry={() => void catalog.refetch()}
        />
      ) : catalog.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-xl" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports available"
          description="Reports appear here once billing is set up."
        />
      ) : filtered.length === 0 ? (
        <NoResultsState
          message="No reports match your filters."
          onClear={clear}
        />
      ) : view === 'table' ? (
        <DataTable columns={columns} data={filtered} pagination={false} />
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.filter((c) =>
            filtered.some((r) => r.category === c),
          ).map((c) => (
            <section key={c} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-3">
                {CATEGORY_META[c].label}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered
                  .filter((r) => r.category === c)
                  .map((r) => (
                    <ReportCard key={r.key} report={r} query={query} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
