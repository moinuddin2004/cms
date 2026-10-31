import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { FileText, Plus, Receipt, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { Can, useAccess } from '@/features/access'
import { formatDate } from '@/lib/formatters'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import { useOpenCharges } from '../../hooks/use-billing-queries'
import { invoicesApi } from '../../services/billing-v2.api'
import type { Charge } from '../../types/billing.types'
import { AddChargeSheet } from '../charges/AddChargeSheet'
import { ChargeRowActions } from '../charges/ChargeRowActions'
import { ChargeBadges, Money } from '../shared/billing-badges'
import { cn } from '@/lib/utils'

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
  const { can } = useAccess()
  const canDesk = can('billing.desk.use')
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
  const totals = useMemo(
    () => ({ balance: rows.reduce((sum, c) => sum + c.balance, 0) }),
    [rows],
  )
  const selectedTotal = rows
    .filter((c) => selected.includes(c.id))
    .reduce((sum, c) => sum + c.balance, 0)
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
            <Badge variant="info" className="px-1.5 py-0 font-mono text-[11px]">
              {row.original.invoiceNumber}
            </Badge>
          ) : (
            <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
              Not invoiced
            </Badge>
          ),
      },
      {
        accessorKey: 'netAmount',
        header: 'Net',
        cell: ({ row }) => (
          <span className="flex flex-col">
            <Money value={row.original.netAmount} />
            {row.original.taxAmount > 0 && (
              <span className="text-xs text-muted-foreground">
                + tax <Money value={row.original.taxAmount} />
              </span>
            )}
          </span>
        ),
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
          <Money
            value={row.original.balance}
            className={cn(
              'font-semibold',
              row.original.balance > 0 ? 'text-amber' : 'text-emerald',
            )}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          canDesk && (
            <div className="flex justify-end">
              <ChargeRowActions charge={row.original} />
            </div>
          ),
      },
    ],
    [canDesk, selected, unbilled],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length > 0 ? (
            <>
              <span className="font-medium text-foreground">{rows.length}</span>{' '}
              open charge{rows.length === 1 ? '' : 's'} · balance{' '}
              <Money
                value={totals.balance}
                className="font-semibold text-foreground"
              />
            </>
          ) : (
            'Charges waiting to be invoiced or paid.'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {canDesk && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-3.5" /> Add charge
            </Button>
          )}
          <Can perm="billing.payment.collect">
            <Button size="sm" onClick={onCollect}>
              <Receipt className="size-3.5" /> Collect payment
            </Button>
          </Can>
        </div>
      </div>

      {canDesk && selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2">
          <p className="text-sm text-primary-text">
            <span className="font-semibold">{selected.length}</span> selected ·{' '}
            <Money value={selectedTotal} className="font-semibold" />
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              disabled={issue.isPending}
              onClick={() =>
                issue.mutate(undefined, { onSuccess: () => setSelected([]) })
              }
            >
              <FileText className="size-3.5" />
              {issue.isPending ? 'Issuing…' : 'Issue invoice'}
            </Button>
            <TooltipButton
              tooltip="Clear selection"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setSelected([])}
            >
              <X className="size-4" />
            </TooltipButton>
          </div>
        </div>
      )}

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
            canDesk && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-3.5" /> Add charge
              </Button>
            )
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
