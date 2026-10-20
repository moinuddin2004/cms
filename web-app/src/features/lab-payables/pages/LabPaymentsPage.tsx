import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Undo2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
  Pagination,
  StatusBadge,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { formatPaisa, rupeesToPaisa } from '@/features/lab-catalog'
import { ReasonDialog } from '@/features/lab-orders'
import { PayLabSheet } from '../components/PayablesSheets'
import {
  ALL,
  LabFilter,
  PayablesNav,
  useClinicLabs,
} from '../components/PayablesNav'
import {
  useLabPayments,
  usePayablesMutation,
  useVendorBills,
} from '../hooks/useLabPayables'
import type { PayLabValues } from '../schemas/lab-payables.schema'
import { labPayablesApi, newPaymentKey } from '../services/lab-payables.api'
import { METHOD_LABEL } from '../types'
import type { VendorPayment } from '../types'

/** Money paid to labs; a wrong entry is reversed, never deleted. */
export function LabPaymentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [labId, setLabId] = useState(ALL)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [paying, setPaying] = useState(false)
  const [reversing, setReversing] = useState<VendorPayment | null>(null)
  const labs = useClinicLabs()
  const lab = labId === ALL ? undefined : labId
  const { data, isLoading, isError, refetch, isFetching } = useLabPayments({
    page,
    limit,
    labId: lab,
  })
  const openBills = useVendorBills({
    labId: lab,
    open: 'true',
    page: 1,
    limit: 100,
  })

  const pay = usePayablesMutation(
    (v: { labId: string; values: PayLabValues; key: string }) =>
      labPayablesApi.pay(
        {
          labId: v.labId,
          amountPaisa: rupeesToPaisa(v.values.amount) ?? 0,
          method: v.values.method,
          reference: v.values.reference || undefined,
          paidOn: v.values.paidOn || undefined,
          allocations: v.values.allocations
            .map((a) => ({
              billId: a.billId,
              amountPaisa: rupeesToPaisa(a.amount) ?? 0,
            }))
            .filter((a) => a.amountPaisa > 0),
        },
        v.key,
      ),
    'Payment recorded',
  )
  const reverse = usePayablesMutation(
    (v: { p: VendorPayment; reason: string }) =>
      labPayablesApi.reversePayment(v.p.id, {
        version: v.p.version,
        reason: v.reason,
      }),
    'Payment reversed',
  )

  // Search is client-side over the page (payment no. / reference).
  const q = search.trim().toLowerCase()
  const rows = (data?.data ?? []).filter(
    (p) =>
      !q ||
      p.paymentNo.toLowerCase().includes(q) ||
      (p.reference ?? '').toLowerCase().includes(q),
  )
  const total = data?.total ?? 0
  const activeFilters = (q ? 1 : 0) + (lab ? 1 : 0)
  const clear = () => {
    setSearch('')
    setLabId(ALL)
    setPage(1)
  }

  const columns = useMemo<ColumnDef<VendorPayment, unknown>[]>(
    () => [
      {
        id: 'no',
        header: 'Payment',
        accessorKey: 'paymentNo',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">{row.original.paymentNo}</p>
            <p className="text-xs text-text-3">
              {row.original.reference ?? METHOD_LABEL[row.original.method]}
            </p>
          </div>
        ),
      },
      { id: 'lab', header: 'Lab', accessorFn: (p) => p.labName ?? '' },
      { id: 'paidOn', header: 'Paid on', accessorKey: 'paidOn' },
      {
        id: 'amount',
        header: 'Amount',
        accessorKey: 'amountPaisa',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatPaisa(row.original.amountPaisa)}
          </span>
        ),
      },
      {
        id: 'advance',
        header: 'Advance left',
        accessorKey: 'unallocatedPaisa',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatPaisa(row.original.unallocatedPaisa)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            tone={row.original.status === 'posted' ? 'success' : 'muted'}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === 'posted' ? (
            <TooltipButton
              tooltip="Reverse payment"
              variant="ghost"
              size="icon"
              onClick={() => setReversing(row.original)}
            >
              <Undo2 className="size-4" />
            </TooltipButton>
          ) : null,
      },
    ],
    [],
  )

  const labName = labs.find(([id]) => id === lab)?.[1] ?? ''
  const addButton = lab ? (
    <Button onClick={() => setPaying(true)}>
      <Plus className="size-4" /> Record payment
    </Button>
  ) : (
    <TooltipButton tooltip="Choose a lab in the filter first" disabled>
      <Plus className="size-4" /> Record payment
    </TooltipButton>
  )
  const onPageSize = (size: number) => {
    setLimit(size)
    setPage(1)
  }

  return (
    <DashboardLayout
      title="Lab payables"
      subtitle="Payments to labs and advances not yet used."
      actions={addButton}
    >
      <div className="space-y-4">
        <PayablesNav active="/lab-payables/payments" />
        <ListToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search payment or reference no…"
          activeFilters={activeFilters}
          onClear={clear}
          resultLabel={
            isFetching && !isLoading
              ? 'Updating…'
              : `${total} payment${total === 1 ? '' : 's'}`
          }
          viewMode={viewMode}
          onViewMode={setViewMode}
          filters={
            <LabFilter
              value={labId}
              labs={labs}
              onChange={(v) => {
                setLabId(v)
                setPage(1)
              }}
            />
          }
        />
        {isLoading ? (
          <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : total === 0 && activeFilters === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No lab payments yet"
            description="Choose a lab and record what you paid; split it over its approved bills."
          />
        ) : rows.length === 0 ? (
          <NoResultsState
            message="No payments match your filters."
            onClear={clear}
          />
        ) : viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={rows}
            pagination={false}
            serverPagination={{
              page,
              pageSize: limit,
              total,
              onPageChange: setPage,
              onPageSizeChange: onPageSize,
              pageSizeOptions: [10, 20, 50, 100],
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{p.paymentNo}</p>
                      <p className="text-xs text-text-3">
                        {p.labName} · {p.paidOn}
                      </p>
                    </div>
                    <StatusBadge
                      status={p.status}
                      tone={p.status === 'posted' ? 'success' : 'muted'}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm">
                    <span className="tabular-nums font-medium">
                      {formatPaisa(p.amountPaisa)}
                    </span>
                    {p.status === 'posted' && (
                      <TooltipButton
                        tooltip="Reverse payment"
                        variant="ghost"
                        size="icon"
                        onClick={() => setReversing(p)}
                      >
                        <Undo2 className="size-4" />
                      </TooltipButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(total / limit))}
              limit={limit}
              total={total}
              onPageChange={setPage}
              onLimitChange={onPageSize}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        )}
      </div>

      {lab && (
        <PayLabSheet
          open={paying}
          labName={labName}
          bills={(openBills.data?.data ?? []).filter(
            (b) => b.status === 'approved' || b.status === 'partially_paid',
          )}
          onOpenChange={setPaying}
          onSubmit={(values) =>
            pay.mutateAsync({ labId: lab, values, key: newPaymentKey() })
          }
        />
      )}
      <ReasonDialog
        open={!!reversing}
        onOpenChange={(o) => !o && setReversing(null)}
        title={`Reverse ${reversing?.paymentNo ?? ''}?`}
        description="Its bills get their balance back and the ledger gets a mirror entry. The payment stays on record as reversed."
        confirmLabel="Reverse payment"
        destructive
        isLoading={reverse.isPending}
        onConfirm={(reason) =>
          reversing &&
          reverse.mutate(
            { p: reversing, reason },
            { onSuccess: () => setReversing(null) },
          )
        }
      />
    </DashboardLayout>
  )
}
