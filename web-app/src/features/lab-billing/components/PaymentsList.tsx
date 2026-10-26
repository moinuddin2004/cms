import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { HandCoins, Undo2, Wallet } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
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
import { DatePicker } from '@/components/shared/DatePicker'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useDebounce } from '@/hooks/useDebounce'
import { useLabBillingMutation, useLabPayments } from '../hooks/useLabBilling'
import { useLabBillingAccess } from '../hooks/useLabBillingAccess'
import { labBillingApi, newIdempotencyKey } from '../services/lab-billing.api'
import { METHOD_LABEL } from '../types'
import type { LabPaymentMethod, LabPaymentRow } from '../types'
import { Paisa, ReasonDialog } from './billing-bits'
import { RefundSheet } from './MoneySheets'

const ALL = 'all'

function PaymentStatus({ p }: { p: LabPaymentRow }) {
  if (p.isReversal)
    return <StatusBadge status="reversal" tone="danger" label="Reversal" />
  if (p.status === 'reversed')
    return <StatusBadge status="reversed" tone="muted" label="Reversed" />
  if (p.advancePaisa > 0)
    return <StatusBadge status="advance" tone="violet" label="Has advance" />
  return <StatusBadge status="posted" tone="success" label="Posted" />
}

/** Lab payments (receipts and reversals). `canRefund` reverses a payment or refunds advance. */
export function PaymentsList() {
  const { canRefund } = useLabBillingAccess()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [method, setMethod] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [reversing, setReversing] = useState<LabPaymentRow | null>(null)
  const [refunding, setRefunding] = useState<LabPaymentRow | null>(null)
  const [reverseKey, setReverseKey] = useState(newIdempotencyKey)
  const query = useDebounce(search, 300).trim()

  const { data, isLoading, isError, isFetching, refetch } = useLabPayments({
    page,
    limit,
    search: query || undefined,
    status: status === ALL ? undefined : (status as 'posted' | 'reversed'),
    method: method === ALL ? undefined : (method as LabPaymentMethod),
    from: from || undefined,
    to: to || undefined,
  })
  const reverse = useLabBillingMutation(
    ({ id, reason }: { id: string; reason: string }) =>
      labBillingApi.reverse(id, reason, reverseKey),
    'Payment reversed',
  )
  const refund = useLabBillingMutation(
    ({
      body,
      key,
    }: {
      body: Parameters<typeof labBillingApi.refund>[0]
      key: string
    }) => labBillingApi.refund(body, key),
    'Refund recorded',
  )

  const activeFilters =
    (query ? 1 : 0) +
    (status !== ALL ? 1 : 0) +
    (method !== ALL ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0)
  const clear = () => {
    setSearch('')
    setStatus(ALL)
    setMethod(ALL)
    setFrom('')
    setTo('')
    setPage(1)
  }

  const actions = (p: LabPaymentRow) =>
    canRefund ? (
      <div className="flex justify-end gap-1">
        {p.advancePaisa > 0 && (
          <TooltipButton
            tooltip="Refund advance"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setRefunding(p)
            }}
          >
            <Wallet className="size-4" />
          </TooltipButton>
        )}
        {p.status === 'posted' && !p.isReversal && p.refundedPaisa === 0 && (
          <TooltipButton
            tooltip="Reverse payment"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setReverseKey(newIdempotencyKey())
              setReversing(p)
            }}
          >
            <Undo2 className="size-4" />
          </TooltipButton>
        )}
      </div>
    ) : null

  const columns = useMemo<ColumnDef<LabPaymentRow, unknown>[]>(
    () => [
      {
        id: 'receipt',
        header: 'Receipt',
        accessorKey: 'receiptNo',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">{row.original.receiptNo}</p>
            <p className="text-xs text-text-3">
              {row.original.reversalOf
                ? `Reverses ${row.original.reversalOf.receiptNo}`
                : METHOD_LABEL[row.original.method]}
            </p>
          </div>
        ),
      },
      {
        id: 'patient',
        header: 'Patient',
        accessorFn: (p) => p.patient.fullName,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.patient.fullName}</p>
            <p className="text-xs text-text-3">
              {row.original.patient.patientNumber}
            </p>
          </div>
        ),
      },
      { id: 'date', header: 'Date', accessorKey: 'receivedOn' },
      {
        id: 'amount',
        header: 'Amount',
        accessorKey: 'amountPaisa',
        cell: ({ row }) => <Paisa value={row.original.amountPaisa} strong />,
      },
      {
        id: 'advance',
        header: 'Advance',
        accessorKey: 'advancePaisa',
        cell: ({ row }) => <Paisa value={row.original.advancePaisa} />,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <PaymentStatus p={row.original} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => actions(row.original),
      },
    ],
    [canRefund],
  )

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const onPageSize = (size: number) => {
    setLimit(size)
    setPage(1)
  }
  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: [string, string][],
    allLabel: string,
  ) => (
    <Select
      value={value}
      onValueChange={(v) => {
        onChange(v)
        setPage(1)
      }}
    >
      <SelectTrigger className="h-9 w-40" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v)
          setPage(1)
        }}
        placeholder="Search receipt, patient or reference…"
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
          <>
            {select(
              'Filter by status',
              status,
              setStatus,
              [
                ['posted', 'Posted'],
                ['reversed', 'Reversed'],
              ],
              'All statuses',
            )}
            {select(
              'Filter by method',
              method,
              setMethod,
              Object.entries(METHOD_LABEL),
              'All methods',
            )}
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
          </>
        }
      />
      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : total === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No lab payments yet"
          description="Payments collected on lab invoices — and advances — show up here with their receipt numbers."
        />
      ) : total === 0 ? (
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
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{p.receiptNo}</p>
                    <p className="truncate text-xs text-text-3">
                      {p.patient.fullName} · {p.receivedOn}
                    </p>
                  </div>
                  <PaymentStatus p={p} />
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2">
                  <Paisa value={p.amountPaisa} strong />
                  {actions(p)}
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

      <ReasonDialog
        open={!!reversing}
        onOpenChange={(o) => !o && setReversing(null)}
        title={`Reverse ${reversing?.receiptNo ?? ''}?`}
        description="A mirror entry is added and the money comes off every invoice it paid. Nothing is deleted. Use this for a wrong entry or a bounced card/transfer."
        confirmLabel="Reverse payment"
        isLoading={reverse.isPending}
        onConfirm={(reason) =>
          reversing &&
          reverse.mutate(
            { id: reversing.id, reason },
            { onSuccess: () => setReversing(null) },
          )
        }
      />
      {refunding && (
        <RefundSheet
          open={!!refunding}
          onOpenChange={(o) => !o && setRefunding(null)}
          patient={refunding.patient}
          maxPaisa={refunding.advancePaisa}
          onRefund={(body, key) => refund.mutateAsync({ body, key })}
        />
      )}
    </div>
  )
}
