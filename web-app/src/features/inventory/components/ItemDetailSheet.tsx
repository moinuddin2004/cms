import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Can } from '@/features/access/components/Can'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { formatDate, formatYmd } from '@/lib/datetime'
import { useInventoryItem } from '../hooks/useInventory'
import { getStockLevel, MovementBadge, QtyDelta } from './inventory-ui'
import type { InventoryItem } from '../types'

interface ItemDetailSheetProps {
  itemId: string | null
  onOpenChange: (open: boolean) => void
  onAdjust: (item: InventoryItem) => void
  onEdit: (item: InventoryItem) => void
}

export function ItemDetailSheet({
  itemId,
  onOpenChange,
  onAdjust,
  onEdit,
}: ItemDetailSheetProps) {
  const { data: item, isLoading } = useInventoryItem(itemId ?? undefined)

  return (
    <Sheet open={!!itemId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{item?.name ?? 'Item Details'}</SheetTitle>
        </SheetHeader>

        {isLoading || !item ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {/* Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="SKU" value={item.sku ?? '—'} />
              <Info label="Category" value={item.category?.name ?? '—'} />
              <Info label="Unit" value={item.unit} />
              <Info
                label="Cost Price"
                value={formatCurrency(Number(item.unitPrice))}
              />
              {item.isBillable && (
                <Info
                  label="Selling Price"
                  value={
                    item.sellingPrice != null
                      ? formatCurrency(Number(item.sellingPrice))
                      : '—'
                  }
                />
              )}
              <Info
                label="Expiry"
                value={
                  formatYmd(item.expiryDate)
                }
              />
            </div>

            {item.description && (
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
            )}

            {/* Stock bar */}
            <StockBar item={item} />

            <Can perm="inventory.stock.adjust">
              <div className="flex gap-2">
                <Button onClick={() => onAdjust(item)}>Adjust Stock</Button>
                <Button variant="outline" onClick={() => onEdit(item)}>
                  Edit Item
                </Button>
              </div>
            </Can>

            {/* Movement history */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Stock Movements</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">After</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(item.recentMovements ?? []).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">
                          {formatDate(m.createdAt)}
                        </TableCell>
                        <TableCell>
                          <MovementBadge type={m.movementType} />
                        </TableCell>
                        <TableCell className="text-right">
                          <QtyDelta value={Number(m.quantity)} />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {Number(m.newStock)}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                          {m.notes ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(item.recentMovements ?? []).length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          No movements yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function StockBar({ item }: { item: InventoryItem }) {
  const stock = Number(item.currentStock)
  const reorder = Number(item.reorderLevel)
  const max = item.maxStock
    ? Number(item.maxStock)
    : Math.max(reorder * 3, stock)
  const pct = max > 0 ? Math.min(100, (stock / max) * 100) : 0
  const level = getStockLevel(item)
  const barColor =
    level === 'out' || level === 'low'
      ? 'bg-red-500'
      : level === 'warning'
        ? 'bg-amber-500'
        : 'bg-green-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Current Stock</span>
        <span className="font-semibold">
          {stock} {item.unit}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Reorder at {reorder}</span>
        {item.maxStock != null && <span>Max {Number(item.maxStock)}</span>}
      </div>
    </div>
  )
}
