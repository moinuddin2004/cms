import { useMemo } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { Banknote, CheckCircle2, Clock, HandCoins, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { ErrorState, PageWrapper } from '@/components/shared'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useDoctorEarnings, useMyEarnings } from '../hooks/use-commissions'
import { bpsToPercent, formatMinor } from '../lib/commission-math'
import type {
  CommissionEntryRow,
  CommissionSourceType,
  DoctorEarningsReport,
  DoctorEarningsRow,
} from '../types/commission.types'
import {
  DatePresetBar,
  ListToolbar,
  LiveDot,
  StatsStrip,
} from '../components/shared/list-toolbar'
import { useReportRange } from './BillingReportsPages'
import { PLAN_TYPE_LABEL } from '../components/compensation/CompensationSheet'

function MoneyAmount({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <span className={cn('tabular-nums', value < 0 && 'text-danger', className)}>
      {formatMinor(value)}
    </span>
  )
}

function totalsStrip(
  totals: DoctorEarningsReport['totals'] | undefined,
  isLoading: boolean,
  doctors?: number,
) {
  return (
    <StatsStrip
      isLoading={isLoading}
      items={[
        ...(doctors !== undefined
          ? [
              {
                key: 'doctors',
                label: 'Doctors',
                value: doctors,
                icon: Users,
                color: 'text-primary-text',
                bg: 'bg-primary-soft',
              },
            ]
          : []),
        {
          key: 'collected',
          label: 'Collected',
          value: formatMinor(totals?.collectedMinor ?? 0),
          icon: Banknote,
          color: 'text-primary-text',
          bg: 'bg-primary-soft',
        },
        {
          key: 'earned',
          label: 'Commission earned',
          value: formatMinor(totals?.earnedMinor ?? 0),
          icon: HandCoins,
          color: 'text-emerald',
          bg: 'bg-emerald-soft',
        },
        {
          key: 'settled',
          label: 'Settled',
          value: formatMinor(totals?.settledMinor ?? 0),
          icon: CheckCircle2,
          color: 'text-violet',
          bg: 'bg-violet-soft',
        },
        {
          key: 'pending',
          label: 'Pending',
          value: formatMinor(totals?.pendingMinor ?? 0),
          icon: Clock,
          color: 'text-amber',
          bg: 'bg-amber-soft',
        },
      ]}
    />
  )
}

const earningColumns = (
  withLocation: boolean,
): ColumnDef<DoctorEarningsRow, unknown>[] => [
  {
    id: 'doctor',
    accessorKey: 'doctorName',
    header: withLocation ? 'Location' : 'Doctor',
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {withLocation
          ? row.original.locationName
          : `Dr. ${row.original.doctorName}`}
      </span>
    ),
  },
  {
    id: 'plan',
    header: 'Plan',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.planType ? (
        <Badge variant="secondary" className="font-normal">
          {PLAN_TYPE_LABEL[row.original.planType]}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: 'collectedMinor',
    header: 'Collected',
    cell: ({ row }) => <MoneyAmount value={row.original.collectedMinor} />,
  },
  {
    accessorKey: 'earnedMinor',
    header: 'Earned',
    cell: ({ row }) => (
      <MoneyAmount value={row.original.earnedMinor} className="font-semibold" />
    ),
  },
  {
    accessorKey: 'settledMinor',
    header: 'Settled',
    cell: ({ row }) => <MoneyAmount value={row.original.settledMinor} />,
  },
  {
    accessorKey: 'pendingMinor',
    header: 'Pending',
    cell: ({ row }) => (
      <MoneyAmount value={row.original.pendingMinor} className="text-amber" />
    ),
  },
]

const SOURCE_LABEL: Record<CommissionSourceType, string> = {
  ALLOCATION: 'Payment',
  UNAPPLY: 'Unapplied',
  CHARGE_ADJUST: 'Invoice edited',
  VOID: 'Charge voided',
  MANUAL: 'Adjustment',
}

const entryColumns: ColumnDef<CommissionEntryRow, unknown>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: 'patientName',
    header: 'Patient',
    cell: ({ row }) => (
      <div>
        <div className="text-sm font-medium">{row.original.patientName}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.chargeDescription}
          {row.original.invoiceNumber ? ` · ${row.original.invoiceNumber}` : ''}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'sourceType',
    header: 'Why',
    cell: ({ row }) => SOURCE_LABEL[row.original.sourceType],
  },
  {
    id: 'rate',
    header: 'Rate',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.rateBps !== null
        ? `${bpsToPercent(row.original.rateBps)}%`
        : 'Fixed',
  },
  {
    accessorKey: 'amountMinor',
    header: 'Amount',
    cell: ({ row }) => (
      <MoneyAmount value={row.original.amountMinor} className="font-medium" />
    ),
  },
  {
    accessorKey: 'settled',
    header: 'Status',
    cell: ({ row }) =>
      row.original.settled ? (
        <Badge variant="secondary">Settled</Badge>
      ) : (
        <Badge variant="outline">Pending</Badge>
      ),
  },
]

/** Admin: commission earned per doctor, settled and pending (feature billing.commissions). */
export function DoctorEarningsPage() {
  const r = useReportRange('month')
  const report = useDoctorEarnings(r.range)
  const rows = report.data?.rows ?? []
  const columns = useMemo(() => earningColumns(false), [])

  return (
    <>
      <PageWrapper
        title="Doctor earnings"
        subtitle="Commission is earned when patient money is applied to the doctor's charges. Internal — never shown to patients."
      />
      <div className="mt-5 space-y-4">
        {totalsStrip(report.data?.totals, report.isLoading, rows.length)}
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
            emptyMessage="No commission-earning doctors in this period."
          />
        )}
      </div>
    </>
  )
}

/** Doctor portal: my own commission, per location, with the ledger lines. */
export function MyEarningsPage() {
  const r = useReportRange('month')
  const me = useMyEarnings(r.range)
  const columns = useMemo(() => earningColumns(true), [])

  return (
    <>
      <PageWrapper
        title="My earnings"
        subtitle="Your commission from patient payments on your work."
      />
      <div className="mt-5 space-y-4">
        {totalsStrip(me.data?.totals, me.isLoading)}
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
              <LiveDot show={me.isFetching && !me.isLoading} />
            </>
          }
        />
        {me.isError ? (
          <ErrorState onRetry={() => void me.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={me.data?.rows ?? []}
              isLoading={me.isLoading}
              skeletonRows={2}
              emptyMessage="You have no commission plan yet."
            />
            <h2 className="pt-2 text-lg font-medium">Commission lines</h2>
            <DataTable
              columns={entryColumns}
              data={me.data?.entries ?? []}
              isLoading={me.isLoading}
              skeletonRows={5}
              pagination
              emptyMessage="No commission in this period."
            />
          </>
        )}
      </div>
    </>
  )
}
