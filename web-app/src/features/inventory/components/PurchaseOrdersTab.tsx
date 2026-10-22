import { useEffect, useState } from 'react'
import { Can } from '@/features/access'
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
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  usePurchaseOrders,
  usePurchaseOrder,
  useCreatePO,
  useUpdatePOStatus,
  useReceivePOItems,
  useCancelPO,
} from '../hooks/usePurchaseOrders'
import { useSuppliers } from '../hooks/useSuppliers'
import { ItemPicker } from './ItemPicker'
import { POStatusBadge } from './inventory-ui'
import type {
  CreatePOItem,
  PurchaseOrder,
  PurchaseOrderStatus,
  ReceivePOItem,
} from '../types'

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
interface DraftItem extends CreatePOItem {
  name: string
  unit: string
}

function CreatePODialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data: suppliers } = useSuppliers()
  const createMutation = useCreatePO()
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])

  useEffect(() => {
    if (open) {
      setSupplierId('')
      setExpectedDate('')
      setTaxRate(0)
      setNotes('')
      setItems([])
    }
  }, [open])

  const subtotal = items.reduce(
    (s, it) =>
      s + (Number(it.orderedQuantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  )
  const taxAmount = subtotal * (Number(taxRate) / 100)
  const total = subtotal + taxAmount

  const addItem = (item: {
    id: string
    name: string
    unit: string
    unitPrice: number
  }) => {
    setItems((prev) => {
      if (prev.some((p) => p.inventoryItemId === item.id)) return prev
      return [
        ...prev,
        {
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          orderedQuantity: 1,
          unitPrice: Number(item.unitPrice) || 0,
        },
      ]
    })
  }
  const setItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    )

  const submit = () => {
    if (!supplierId) {
      toast.error('Select a supplier')
      return
    }
    if (items.length === 0) {
      toast.error('Add at least one item')
      return
    }
    createMutation.mutate(
      {
        supplierId,
        expectedDeliveryDate: expectedDate || undefined,
        taxRate: Number(taxRate) || 0,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          inventoryItemId: it.inventoryItemId,
          orderedQuantity: Number(it.orderedQuantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
        })),
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Supplier <span className="text-destructive">*</span>
              </Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
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
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery</Label>
              <DatePicker
                value={expectedDate}
                onChange={(v) => setExpectedDate(v)}
                clearable
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Add Items</Label>
            <ItemPicker
              onSelect={(item) =>
                addItem({
                  id: item.id,
                  name: item.name,
                  unit: item.unit,
                  unitPrice: Number(item.unitPrice),
                })
              }
              selectedIds={items.map((i) => i.inventoryItemId)}
            />
          </div>

          {items.length > 0 && (
            <div className="space-y-2 rounded-md border p-2">
              {items.map((it, idx) => (
                <div key={it.inventoryItemId} className="flex items-end gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.unit}</p>
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.orderedQuantity}
                      onChange={(e) =>
                        setItem(idx, {
                          orderedQuantity: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Unit Price</Label>
                    <Input
                      type="number"
                      min={0}
                      value={it.unitPrice}
                      onChange={(e) =>
                        setItem(idx, { unitPrice: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="w-24 text-right text-sm">
                    {formatCurrency(
                      (Number(it.orderedQuantity) || 0) *
                        (Number(it.unitPrice) || 0),
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                min={0}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col items-end justify-end gap-0.5 text-sm">
              <span className="text-muted-foreground">
                Subtotal: {formatCurrency(subtotal)}
              </span>
              <span className="text-muted-foreground">
                Tax: {formatCurrency(taxAmount)}
              </span>
              <span className="text-base font-bold">
                Total: {formatCurrency(total)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              className="h-16 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create PO
            </Button>
          </div>
        </div>
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
  const receiveMutation = useReceivePOItems()
  const [rows, setRows] = useState<Record<string, ReceivePOItem>>({})

  const pendingItems = (po.items ?? []).filter(
    (it) => Number(it.receivedQuantity) < Number(it.orderedQuantity),
  )

  useEffect(() => {
    if (open) {
      const init: Record<string, ReceivePOItem> = {}
      pendingItems.forEach((it) => {
        init[it.id] = { poItemId: it.id, receivedQuantity: 0 }
      })
      setRows(init)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, po.id])

  const setRow = (id: string, patch: Partial<ReceivePOItem>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const submit = () => {
    const items = Object.values(rows).filter(
      (r) => Number(r.receivedQuantity) > 0,
    )
    if (items.length === 0) {
      toast.error('Enter at least one quantity to receive')
      return
    }
    receiveMutation.mutate(
      { id: po.id, items },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Receive Items — {po.poNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {pendingItems.map((it) => {
            const remaining =
              Number(it.orderedQuantity) - Number(it.receivedQuantity)
            const row = rows[it.id]
            return (
              <div key={it.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {it.inventoryItem?.name ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Number(it.receivedQuantity)} / {Number(it.orderedQuantity)}{' '}
                    received · {remaining} remaining
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Receiving now</Label>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      value={row?.receivedQuantity ?? 0}
                      onChange={(e) =>
                        setRow(it.id, {
                          receivedQuantity: Math.min(
                            Number(e.target.value),
                            remaining,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Batch #</Label>
                    <Input
                      value={row?.batchNumber ?? ''}
                      onChange={(e) =>
                        setRow(it.id, { batchNumber: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Expiry</Label>
                    <DatePicker
                      value={row?.expiryDate ?? ''}
                      onChange={(v) => setRow(it.id, { expiryDate: v })}
                      clearable
                    />
                  </div>
                </div>
              </div>
            )
          })}
          {pendingItems.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              All items already received
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={receiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={receiveMutation.isPending || pendingItems.length === 0}
            >
              {receiveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Receive Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
