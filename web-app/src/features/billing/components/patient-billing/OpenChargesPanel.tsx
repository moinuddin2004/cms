import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { FileText, Plus, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { formatDate } from '@/lib/formatters'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import { useOpenCharges } from '../../hooks/use-billing-queries'
import { invoicesApi } from '../../services/billing-v2.api'
import type { Charge } from '../../types/billing.types'
import { AddChargeSheet } from '../charges/AddChargeSheet'
import { ChargeRowActions } from '../charges/ChargeRowActions'
import { ChargeBadges, Money } from '../shared/billing-badges'

/**
 * Open charges of a patient: unbilled first, then billed with a balance.
 * "Issue invoice" bills selected unbilled charges for a patient leaving
 * without paying (D3b).
 */
export function OpenChargesPanel({
  patientId,
  onCollect,
}: {
  patientId: string
  onCollect: () => void
}) {
  const charges = useOpenCharges(patientId)
  const [selected, setSelected] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const issue = useBillingMutation(
    () => invoicesApi.issue({ patientId, chargeIds: selected }),
    {
      success: (inv) => `Invoice ${inv.invoiceNumber} issued`,
    },
  )

  const rows = useMemo(() => charges.data ?? [], [charges.data])
  const unbilled = useMemo(
    () => rows.filter((c) => !c.invoiceId).map((c) => c.id),
    [rows],
  )

  const columns = useMemo<ColumnDef<Charge, unknown>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        header: () => (
          <Checkbox
            aria-label="Select all unbilled"
            checked={unbilled.length > 0 && selected.length === unbilled.length}
            onCheckedChange={() =>
              setSelected(selected.length === unbilled.length ? [] : unbilled)
            }
          />
        ),
        cell: ({ row }) =>
          !row.original.invoiceId && (
            <Checkbox
              aria-label={`Select ${row.original.description}`}
              checked={selected.includes(row.original.id)}
              onCheckedChange={() =>
                setSelected((s) =>
                  s.includes(row.original.id)
                    ? s.filter((x) => x !== row.original.id)
                    : [...s, row.original.id],
                )
              }
            />
          ),
      },
      {
        accessorKey: 'description',
        header: 'Charge',
        cell: ({ row }) => (
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span dir="auto" className="text-sm font-medium">
                {row.original.description}
              </span>
              <ChargeBadges charge={row.original} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {row.original.doctorName ?? '—'}
              {row.original.discount && ` · ${row.original.discount.name}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'chargeDate',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.chargeDate),
      },
      {
        id: 'invoice',
        header: 'Invoice',
        accessorFn: (r) => r.invoiceNumber ?? '',
        cell: ({ row }) =>
          row.original.invoiceNumber ? (
            <span className="font-mono text-[12px]">
              {row.original.invoiceNumber}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not invoiced</span>
          ),
      },
      {
        accessorKey: 'netAmount',
        header: 'Net',
        cell: ({ row }) => <Money value={row.original.netAmount} />,
      },
      {
        accessorKey: 'allocatedAmount',
        header: 'Paid',
        cell: ({ row }) => (
          <Money
            value={row.original.allocatedAmount}
            className="text-muted-foreground"
          />
        ),
      },
      {
        accessorKey: 'balance',
        header: 'Balance',
        cell: ({ row }) => (
          <Money value={row.original.balance} className="font-semibold" />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <ChargeRowActions charge={row.original} />
          </div>
        ),
      },
    ],
    [selected, unbilled],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" /> Add charge
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.length || issue.isPending}
          onClick={() =>
            issue.mutate(undefined, { onSuccess: () => setSelected([]) })
          }
        >
          <FileText className="size-3.5" /> Issue invoice
          {selected.length ? ` (${selected.length})` : ''}
        </Button>
        <Button size="sm" onClick={onCollect}>
          <Receipt className="size-3.5" /> Collect payment
        </Button>
      </div>

      {charges.isLoading ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : charges.isError ? (
        <ErrorState onRetry={() => void charges.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nothing to bill"
          description="All charges of this patient are paid."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Add charge
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={rows} pagination={false} />
      )}
      <AddChargeSheet
        patientId={patientId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  )
}
