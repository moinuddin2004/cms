import { useState } from 'react'
import { Can } from '@/features/access/components/Can'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/shared/DatePicker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  usePurchaseOrders,
  usePurchaseOrder,
  useUpdatePOStatus,
  useCancelPO,
} from '../hooks/usePurchaseOrders'
import {
  useCreatePOForm,
  useReceivePOForm,
} from '../hooks/usePurchaseOrderForms'
import { listError } from '../lib/listError'
import { useSuppliers } from '../hooks/useSuppliers'
import { ItemPicker } from './ItemPicker'
import { POStatusBadge } from './inventory-ui'
import type { PurchaseOrder, PurchaseOrderStatus } from '../types'

const STATUS_TABS: { value: PurchaseOrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partial' },
  { value: 'RECEIVED', label: 'Received' },
]

export function PurchaseOrdersTab() {
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'all'>(
    'all',
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: response, isLoading } = usePurchaseOrders(
    statusFilter === 'all' ? {} : { status: statusFilter },
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.value}
              variant={statusFilter === t.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <Can perm="inventory.po.manage">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create PO
          </Button>
        </Can>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {response?.data.map((po) => (
                  <TableRow
                    key={po.id}
                    className="cursor-pointer"
                    onClick={() => setDetailId(po.id)}
                  >
                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                    <TableCell>{po.supplier?.name ?? '—'}</TableCell>
                    <TableCell>
                      {po.orderDate
                        ? new Date(po.orderDate).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {po.expectedDeliveryDate
                        ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {po.itemsCount ?? po.items?.length ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(po.totalAmount))}
                    </TableCell>
                    <TableCell>
                      <POStatusBadge status={po.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {response && response.data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No purchase orders
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreatePODialog open={createOpen} onOpenChange={setCreateOpen} />
      <PODetailSheet
        poId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  )
}

// ─── Create PO ──────────────────────────────────────────────────────
const rowError = (msg: string | undefined) =>
  msg ? <p className="text-xs font-medium text-danger">{msg}</p> : null

function CreatePODialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data: suppliers } = useSuppliers()
  const { form } = useCreatePOForm({
    open,
    onDone: () => onOpenChange(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-5 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="supplierId">
              {(f) => (
                <FieldWrapper label="Supplier" required error={fieldError(f)}>
                  <Select
                    value={f.state.value}
                    onValueChange={(v) => f.handleChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="expectedDeliveryDate">
              {(f) => (
                <FieldWrapper label="Expected Delivery">
                  <DatePicker
                    value={f.state.value}
                    onChange={(v) => f.handleChange(v)}
                    clearable
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>

          <form.Field name="items" mode="array">
            {(items) => (
              <>
                <div className="space-y-2">
                  <Label>Add Items</Label>
                  <ItemPicker
                    onSelect={(item) => {
                      if (
                        items.state.value.some(
                          (p) => p.inventoryItemId === item.id,
                        )
                      )
                        return
                      items.pushValue({
                        inventoryItemId: item.id,
                        name: item.name,
                        unit: item.unit,
                        orderedQuantity: '1',
                        unitPrice: String(Number(item.unitPrice) || 0),
                      })
                    }}
                    selectedIds={items.state.value.map(
                      (i) => i.inventoryItemId,
                    )}
                  />
                  {rowError(listError(items))}
                </div>

                {items.state.value.length > 0 && (
                  <div className="space-y-2 rounded-md border p-2">
                    {items.state.value.map((it, idx) => (
                      <div
                        key={it.inventoryItemId}
                        className="flex items-start gap-2"
                      >
                        <div className="flex-1 pt-5">
                          <p className="text-sm font-medium">{it.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {it.unit}
                          </p>
                        </div>
                        <form.Field name={`items[${idx}].orderedQuantity`}>
                          {(f) => (
                            <div className="w-24 space-y-1">
                              <Label className="text-xs">Qty</Label>
                              <NumberInput
                                mode="integer"
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                                onBlur={f.handleBlur}
                                aria-invalid={!!fieldError(f)}
                              />
                              {rowError(fieldError(f))}
                            </div>
                          )}
                        </form.Field>
                        <form.Field name={`items[${idx}].unitPrice`}>
                          {(f) => (
                            <div className="w-28 space-y-1">
                              <Label className="text-xs">Unit Price</Label>
                              <NumberInput
                                mode="decimal"
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                                onBlur={f.handleBlur}
                                aria-invalid={!!fieldError(f)}
                              />
                              {rowError(fieldError(f))}
                            </div>
                          )}
                        </form.Field>
                        <div className="w-24 pt-7 text-right text-sm">
                          {formatCurrency(
                            (Number(it.orderedQuantity) || 0) *
                              (Number(it.unitPrice) || 0),
                          )}
                        </div>
                        <TooltipButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          tooltip="Remove item"
                          onClick={() => items.removeValue(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </TooltipButton>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="taxRate">
              {(f) => (
                <FieldWrapper
                  label="Tax Rate (%)"
                  htmlFor="po-tax-rate"
                  error={fieldError(f)}
                >
                  <NumberInput
                    id="po-tax-rate"
                    mode="decimal"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    aria-invalid={!!fieldError(f)}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Subscribe
              selector={(s) => {
                const subtotal = s.values.items.reduce(
                  (sum, it) =>
                    sum +
                    (Number(it.orderedQuantity) || 0) *
                      (Number(it.unitPrice) || 0),
                  0,
                )
                const tax = subtotal * ((Number(s.values.taxRate) || 0) / 100)
                return [subtotal, tax] as const
              }}
            >
              {([subtotal, taxAmount]) => (
                <div className="flex flex-col items-end justify-end gap-0.5 text-sm">
                  <span className="text-muted-foreground">
                    Subtotal: {formatCurrency(subtotal)}
                  </span>
                  <span className="text-muted-foreground">
                    Tax: {formatCurrency(taxAmount)}
                  </span>
                  <span className="text-base font-bold">
                    Total: {formatCurrency(subtotal + taxAmount)}
                  </span>
                </div>
              )}
            </form.Subscribe>
          </div>

          <form.Field name="notes">
            {(f) => (
              <FieldWrapper
                label="Notes"
                htmlFor="po-notes"
                error={fieldError(f)}
              >
                <Textarea
                  id="po-notes"
                  className="h-16 resize-none"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create PO
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── PO Detail ──────────────────────────────────────────────────────
function PODetailSheet({
  poId,
  onOpenChange,
}: {
  poId: string | null
  onOpenChange: (o: boolean) => void
}) {
  const { data: po, isLoading } = usePurchaseOrder(poId ?? undefined)
  const statusMutation = useUpdatePOStatus()
  const cancelMutation = useCancelPO()
  const [receiveOpen, setReceiveOpen] = useState(false)

  return (
    <Sheet open={!!poId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{po?.poNumber ?? 'Purchase Order'}</SheetTitle>
        </SheetHeader>

        {isLoading || !po ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">{po.supplier?.name}</p>
                <p className="text-muted-foreground">
                  {po.orderDate
                    ? `Ordered ${new Date(po.orderDate).toLocaleDateString()}`
                    : 'Not ordered yet'}
                </p>
              </div>
              <POStatusBadge status={po.status} />
            </div>

            <Can perm="inventory.po.manage">
              {/* Action buttons per status */}
              <div className="flex flex-wrap gap-2">
                {po.status === 'DRAFT' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        statusMutation.mutate({ id: po.id, status: 'ORDERED' })
                      }
                      disabled={statusMutation.isPending}
                    >
                      Mark as Ordered
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelMutation.mutate(po.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {(po.status === 'ORDERED' ||
                  po.status === 'PARTIALLY_RECEIVED') && (
                  <Button size="sm" onClick={() => setReceiveOpen(true)}>
                    {po.status === 'PARTIALLY_RECEIVED'
                      ? 'Receive More Items'
                      : 'Receive Items'}
                  </Button>
                )}
              </div>
            </Can>

            {/* Items table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items?.map((it) => {
                    const ordered = Number(it.orderedQuantity)
                    const received = Number(it.receivedQuantity)
                    const pct = ordered > 0 ? (received / ordered) * 100 : 0
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">
                          {it.inventoryItem?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">{ordered}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span>
                              {received} / {ordered}
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  pct >= 100 ? 'bg-green-500' : 'bg-amber-500',
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(it.unitPrice))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(it.totalPrice))}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col items-end gap-0.5 text-sm">
              <span className="text-muted-foreground">
                Subtotal: {formatCurrency(Number(po.subtotal))}
              </span>
              <span className="text-muted-foreground">
                Tax ({Number(po.taxRate)}%):{' '}
                {formatCurrency(Number(po.taxAmount))}
              </span>
              <span className="text-base font-bold">
                Total: {formatCurrency(Number(po.totalAmount))}
              </span>
            </div>

            {po.notes && (
              <p className="text-sm text-muted-foreground">{po.notes}</p>
            )}

            <ReceiveItemsDialog
              po={po}
              open={receiveOpen}
              onOpenChange={setReceiveOpen}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Receive Items ──────────────────────────────────────────────────
function ReceiveItemsDialog({
  po,
  open,
  onOpenChange,
}: {
  po: PurchaseOrder
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { form } = useReceivePOForm({
    open,
    po,
    onDone: () => onOpenChange(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Receive Items — {po.poNumber}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="items" mode="array">
            {(items) => (
              <>
                {items.state.value.map((row, idx) => {
                  const it = po.items?.find((p) => p.id === row.poItemId)
                  return (
                    <div
                      key={row.poItemId}
                      className="space-y-2 rounded-md border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {Number(it?.receivedQuantity ?? 0)} /{' '}
                          {Number(it?.orderedQuantity ?? 0)} received ·{' '}
                          {row.remaining} remaining
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <form.Field name={`items[${idx}].receivedQuantity`}>
                          {(f) => (
                            <div className="space-y-1">
                              <Label className="text-xs">Receiving now</Label>
                              <NumberInput
                                mode="integer"
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                                onBlur={f.handleBlur}
                                aria-invalid={!!fieldError(f)}
                              />
                              {fieldError(f) && (
                                <p className="text-xs font-medium text-danger">
                                  {fieldError(f)}
                                </p>
                              )}
                            </div>
                          )}
                        </form.Field>
                        <form.Field name={`items[${idx}].batchNumber`}>
                          {(f) => (
                            <div className="space-y-1">
                              <Label className="text-xs">Batch #</Label>
                              <Input
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                                onBlur={f.handleBlur}
                              />
                              {fieldError(f) && (
                                <p className="text-xs font-medium text-danger">
                                  {fieldError(f)}
                                </p>
                              )}
                            </div>
                          )}
                        </form.Field>
                        <form.Field name={`items[${idx}].expiryDate`}>
                          {(f) => (
                            <div className="space-y-1">
                              <Label className="text-xs">Expiry</Label>
                              <DatePicker
                                value={f.state.value}
                                onChange={(v) => f.handleChange(v)}
                                clearable
                              />
                            </div>
                          )}
                        </form.Field>
                      </div>
                    </div>
                  )
                })}
                {items.state.value.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    All items already received
                  </p>
                ) : (
                  listError(items) && (
                    <p className="text-xs font-medium text-danger">
                      {listError(items)}
                    </p>
                  )
                )}
              </>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s) =>
              [s.canSubmit, s.isSubmitting, s.values.items.length] as const
            }
          >
            {([canSubmit, isSubmitting, pendingCount]) => (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || pendingCount === 0}
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Receive Selected
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  )
}
