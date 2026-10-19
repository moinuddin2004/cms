import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Activity,
  BadgePercent,
  Banknote,
  Percent,
  Stethoscope,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { ErrorState, PageWrapper } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  useBillingActivity,
  useDoctorRevenue,
} from '../hooks/use-billing-queries'
import type {
  ActivityDayTotal,
  ActivityRow,
  DoctorRevenueReport,
} from '../types/billing.types'
import { Money } from '../components/shared/billing-badges'
import { SectionHeading } from '../components/shared/billing-ui'
import {
  DatePresetBar,
  ListToolbar,
  LiveDot,
  presetRange,
  StatsStrip,
} from '../components/shared/list-toolbar'
import type { DateRange, RangePreset } from '../components/shared/list-toolbar'

/** Preset + custom range state that always resolves to a full from/to. */
export function useReportRange(initial: Exclude<RangePreset, 'custom' | 'all'>) {
  const [preset, setPreset] = useState<RangePreset>(initial)
  const [custom, setCustom] = useState<DateRange>({})
  const range = useMemo(() => {
    const r = presetRange(preset, custom)
    const today = new Date().toLocaleDateString('en-CA')
    return { from: r.from ?? today, to: r.to ?? r.from ?? today }
  }, [preset, custom])
  return {
    preset,
    custom,
    range,
    set: (p: RangePreset, c: DateRange) => (setPreset(p), setCustom(c)),
  }
}

type DoctorRow = DoctorRevenueReport['rows'][number]

/** Admin: billed, discounts and collected per doctor (D24, 6.21) — Appointments layout. */
export function DoctorRevenuePage() {
  const r = useReportRange('month')
  const report = useDoctorRevenue(r.range)
  const totals = report.data?.totals
  const rows = report.data?.rows ?? []

  const columns = useMemo<ColumnDef<DoctorRow, unknown>[]>(
    () => [
      {
        id: 'doctor',
        accessorKey: 'doctorName',
        header: 'Doctor',
        cell: ({ row }) =>
          row.original.doctorId ? (
            <span className="text-sm font-medium">
              Dr. {row.original.doctorName}
            </span>
          ) : (
            <span className="text-sm italic text-muted-foreground">
              No doctor
            </span>
          ),
      },
      {
        accessorKey: 'billed',
        header: 'Billed',
        cell: ({ row }) => (
          <Money value={row.original.billed} className="font-medium" />
        ),
      },
      {
        accessorKey: 'discounts',
        header: 'Discounts',
        cell: ({ row }) => (
          <Money
            value={row.original.discounts}
            className="text-muted-foreground"
          />
        ),
      },
      {
        accessorKey: 'collected',
        header: 'Collected',
        cell: ({ row }) => (
          <Money
            value={row.original.collected}
            className="font-semibold text-foreground"
          />
        ),
      },
      {
        id: 'rate',
        header: 'Collected %',
        enableSorting: false,
        cell: ({ row }) => {
          const pct =
            row.original.billed > 0
              ? Math.round((row.original.collected / row.original.billed) * 100)
              : 0
          return (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                pct >= 90
                  ? 'border-emerald/20 bg-emerald-soft text-emerald'
                  : pct >= 50
                    ? 'border-amber/20 bg-amber-soft text-amber'
                    : 'border-danger/20 bg-danger-soft text-danger',
              )}
            >
              {pct}%
            </span>
          )
        },
      },
    ],
    [],
  )

  return (
    <>
      <PageWrapper
        title="Doctor revenue"
        subtitle="Billed by invoice date; collected by payment date (releases subtract)."
      />
      <div className="mt-5 space-y-4">
        <StatsStrip
          isLoading={report.isLoading}
          items={[
            {
              key: 'doctors',
              label: 'Doctors',
              value: rows.filter((x) => x.doctorId).length,
              icon: Users,
              color: 'text-primary-text',
              bg: 'bg-primary-soft',
            },
            {
              key: 'billed',
              label: 'Billed',
              value: formatCurrency(totals?.billed ?? 0),
              icon: Stethoscope,
              color: 'text-primary-text',
              bg: 'bg-primary-soft',
            },
            {
              key: 'discounts',
              label: 'Discounts',
              value: formatCurrency(totals?.discounts ?? 0),
              icon: BadgePercent,
              color: 'text-amber',
              bg: 'bg-amber-soft',
            },
            {
              key: 'collected',
              label: 'Collected',
              value: formatCurrency(totals?.collected ?? 0),
              icon: Banknote,
              color: 'text-emerald',
              bg: 'bg-emerald-soft',
            },
            {
              key: 'rate',
              label: 'Collected %',
              value: totals?.billed
                ? `${Math.round((totals.collected / totals.billed) * 100)}%`
                : '—',
              icon: Percent,
              color: 'text-violet',
              bg: 'bg-violet-soft',
            },
          ]}
        />
        <ListToolbar
          filters={
            <>
              <DatePresetBar
                presets={['today', 'month', 'lastMonth', 'past30']}
                preset={r.preset}
                custom={r.custom}
                onChange={r.set}
                fallback="month"
              />
              <LiveDot show={report.isFetching && !report.isLoading} />
              <div className="ml-auto text-xs text-muted-foreground">
                {r.range.from} → {r.range.to}
              </div>
            </>
          }
        />
        {report.isError ? (
          <ErrorState onRetry={() => void report.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={report.isLoading}
            skeletonRows={5}
            emptyMessage="No billing in this period."
          />
        )}
      </div>
    </>
  )
}

const ACTION_LABEL: Record<string, string> = {
  CREATED: 'Created',
  UPDATED: 'Updated',
  DELETED: 'Deleted',
  VOIDED: 'Voided',
  DISCOUNT_APPLIED: 'Discount',
  DISCOUNT_REMOVED: 'Discount removed',
  PRICE_CHANGED: 'Price changed',
  ISSUED: 'Issued',
  EDITED: 'Edited',
  CANCELLED: 'Cancelled',
  ALLOCATED: 'Advance applied',
  UNAPPLIED: 'Unapplied',
  REFUNDED: 'Refunded',
  CLOSED: 'Counter closed',
}
const ACTION_TONE: Record<
  string,
  'success' | 'warning' | 'danger' | 'info' | 'violet' | 'muted'
> = {
  ISSUED: 'info',
  CREATED: 'success',
  EDITED: 'warning',
  DISCOUNT_APPLIED: 'warning',
  VOIDED: 'danger',
  CANCELLED: 'danger',
  REFUNDED: 'violet',
  UNAPPLIED: 'warning',
  CLOSED: 'info',
}

/** Admin audit feed + per-user day totals of edits, refunds, discounts (plan §8.3). */
export function BillingActivityPage() {
  const r = useReportRange('today')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const activity = useBillingActivity({ ...r.range, page, limit })
  const feed = activity.data?.feed

  const totalColumns = useMemo<ColumnDef<ActivityDayTotal, unknown>[]>(
    () => [
      { accessorKey: 'date', header: 'Date' },
      {
        id: 'user',
        header: 'User',
        accessorFn: (t) => t.actorName ?? '—',
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      { accessorKey: 'edits', header: 'Edits' },
      { accessorKey: 'cancellations', header: 'Cancels' },
      {
        accessorKey: 'refundAmount',
        header: 'Refunds',
        cell: ({ row }) => (
          <span>
            {row.original.refunds} · <Money value={row.original.refundAmount} />
          </span>
        ),
      },
      {
        accessorKey: 'discountAmount',
        header: 'Discounts',
        cell: ({ row }) => (
          <span>
            {row.original.discounts} ·{' '}
            <Money value={row.original.discountAmount} />
          </span>
        ),
      },
    ],
    [],
  )
  const feedColumns = useMemo<ColumnDef<ActivityRow, unknown>[]>(
    () => [
      {
        accessorKey: 'at',
        header: 'Time',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {new Date(row.original.at).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'user',
        header: 'User',
        accessorFn: (x) => x.actorName ?? '—',
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <Badge variant={ACTION_TONE[row.original.action] ?? 'muted'}>
            {ACTION_LABEL[row.original.action] ?? row.original.action}
          </Badge>
        ),
      },
      {
        accessorKey: 'entityType',
        header: 'Document',
        cell: ({ row }) => (
          <span className="capitalize text-muted-foreground">
            {row.original.entityType.toLowerCase().replace('_', ' ')}
          </span>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) =>
          row.original.amount != null ? (
            <Money value={row.original.amount} />
          ) : (
            ''
          ),
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        enableSorting: false,
        cell: ({ row }) => (
          <span dir="auto" className="block max-w-xs truncate">
            {row.original.reason ?? ''}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <>
      <PageWrapper
        title="Billing activity"
        subtitle="Every billing change with who, when and why."
      />
      <div className="mt-5 space-y-4">
        <ListToolbar
          filters={
            <>
              <DatePresetBar
                presets={['today', 'month', 'past30']}
                preset={r.preset}
                custom={r.custom}
                onChange={(p, c) => {
                  r.set(p, c)
                  setPage(1)
                }}
                fallback="today"
              />
              <LiveDot show={activity.isFetching && !activity.isLoading} />
            </>
          }
        />
        {!!activity.data?.dayTotals.length && (
          <section className="space-y-2">
            <SectionHeading icon={Users} title="Per user per day" />
            <DataTable
              columns={totalColumns}
              data={activity.data.dayTotals}
              pagination={false}
            />
          </section>
        )}
        <section className="space-y-2">
          <SectionHeading icon={Activity} title="Activity feed" />
          {activity.isError ? (
            <ErrorState onRetry={() => void activity.refetch()} />
          ) : (
            <DataTable
              columns={feedColumns}
              data={feed?.data ?? []}
              isLoading={activity.isLoading}
              emptyMessage="No billing activity in this period."
              serverPagination={{
                page,
                pageSize: limit,
                total: feed?.total ?? 0,
                onPageChange: setPage,
                onPageSizeChange: (l) => {
                  setLimit(l)
                  setPage(1)
                },
              }}
            />
          )}
        </section>
      </div>
    </>
  )
}
