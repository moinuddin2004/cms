import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Activity,
  BadgePercent,
  Banknote,
  Stethoscope,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import {
  ErrorState,
  InitialsAvatar,
  LoadingSkeleton,
  PageWrapper,
  StatCard,
} from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
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
import { FilterBar, SectionHeading } from '../components/shared/billing-ui'

const todayLocal = () => new Date().toLocaleDateString('en-CA')

function RangeFilter({
  range,
  onChange,
}: {
  range: { from: string; to: string }
  onChange: (r: { from: string; to: string }) => void
}) {
  return (
    <FilterBar>
      <span className="text-xs font-medium text-text-3">Period</span>
      <DateRangePicker
        aria-label="Report period"
        className="h-8 w-[300px] text-xs"
        value={range}
        // A report always needs a period, so it can't be cleared.
        clearable={false}
        onChange={(r) => r.from && onChange(r)}
      />
    </FilterBar>
  )
}

type DoctorRow = DoctorRevenueReport['rows'][number]

/** Admin: billed, discounts and collected per doctor (D24, 6.21). */
export function DoctorRevenuePage() {
  const [range, setRange] = useState({
    from: todayLocal().slice(0, 8) + '01',
    to: todayLocal(),
  })
  const report = useDoctorRevenue(range)
  const columns = useMemo<ColumnDef<DoctorRow, unknown>[]>(
    () => [
      {
        accessorKey: 'doctorName',
        header: 'Doctor',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <InitialsAvatar
              name={row.original.doctorName}
              seed={row.original.doctorId ?? 'none'}
              size="sm"
            />
            <span className="text-sm font-semibold">
              {row.original.doctorName}
            </span>
          </div>
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
          <Money value={row.original.collected} className="font-semibold" />
        ),
      },
    ],
    [],
  )
  const totals = report.data?.totals

  return (
    <PageWrapper
      title="Doctor revenue"
      subtitle="Billed by invoice date · collected by payment date (releases subtract)"
    >
      <RangeFilter range={range} onChange={setRange} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Billed"
          value={formatCurrency(totals?.billed ?? 0)}
          icon={Stethoscope}
        />
        <StatCard
          label="Discounts"
          value={formatCurrency(totals?.discounts ?? 0)}
          icon={BadgePercent}
          iconTone="amber"
        />
        <StatCard
          label="Collected"
          value={formatCurrency(totals?.collected ?? 0)}
          icon={Banknote}
          iconTone="emerald"
        />
      </div>
      {report.isError ? (
        <ErrorState onRetry={() => void report.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={report.data?.rows ?? []}
          isLoading={report.isLoading}
          emptyMessage="No billing in this period."
        />
      )}
    </PageWrapper>
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
  const [range, setRange] = useState({ from: todayLocal(), to: todayLocal() })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const activity = useBillingActivity({ ...range, page, limit })
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
        accessorFn: (r) => r.actorName ?? '—',
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
    <PageWrapper
      title="Billing activity"
      subtitle="Every billing change with who, when and why"
    >
      <RangeFilter
        range={range}
        onChange={(r) => {
          setRange(r)
          setPage(1)
        }}
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
        {activity.isLoading ? (
          <LoadingSkeleton variant="table" />
        ) : activity.isError ? (
          <ErrorState onRetry={() => void activity.refetch()} />
        ) : (
          <DataTable
            columns={feedColumns}
            data={feed?.data ?? []}
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
    </PageWrapper>
  )
}
