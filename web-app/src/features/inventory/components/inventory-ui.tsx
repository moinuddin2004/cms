import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatYmd, todayYmd, ymdToDate } from '@/lib/datetime'
import type {
  InventoryItem,
  StockMovementType,
  PurchaseOrderStatus,
} from '../types'

// ─── Stock level helpers ────────────────────────────────────────────
export type StockLevel = 'out' | 'low' | 'warning' | 'healthy'

export function getStockLevel(item: {
  currentStock: number
  reorderLevel: number
}): StockLevel {
  const stock = Number(item.currentStock)
  const reorder = Number(item.reorderLevel)
  if (stock <= 0) return 'out'
  if (stock <= reorder) return 'low'
  if (stock <= reorder * 2) return 'warning'
  return 'healthy'
}

const STOCK_COLORS: Record<StockLevel, string> = {
  out: 'text-muted-foreground',
  low: 'text-red-600',
  warning: 'text-amber-600',
  healthy: 'text-green-600',
}

export function StockCell({ item }: { item: InventoryItem }) {
  const level = getStockLevel(item)
  if (level === 'out') {
    return <span className="text-sm font-medium text-muted-foreground">Out of stock</span>
  }
  return (
    <span className={cn('text-sm font-semibold', STOCK_COLORS[level])}>
      {Number(item.currentStock)} / {Number(item.reorderLevel)}{' '}
      <span className="font-normal text-muted-foreground">{item.unit}</span>
    </span>
  )
}

// ─── Expiry helpers ─────────────────────────────────────────────────
/** Calendar days from the clinic's today to a "YYYY-MM-DD" date. */
export function daysUntil(date: string | null): number | null {
  if (!date) return null
  const now = ymdToDate(todayYmd())
  const target = ymdToDate(date.slice(0, 10))
  return Math.round((target.getTime() - now.getTime()) / 86_400_000)
}

export function ExpiryCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const days = daysUntil(date)
  const formatted = formatYmd(date)
  if (days !== null && days < 0) {
    return <Badge variant="destructive">Expired</Badge>
  }
  const expiringSoon = days !== null && days <= 30
  return (
    <span className={cn('text-sm', expiringSoon && 'font-medium text-red-600')}>
      {formatted}
    </span>
  )
}

// ─── Movement badge ─────────────────────────────────────────────────
const MOVEMENT_STYLES: Record<StockMovementType, string> = {
  PURCHASE_IN: 'bg-green-100 text-green-800',
  INITIAL_STOCK: 'bg-green-100 text-green-800',
  TRANSFER_IN: 'bg-green-100 text-green-800',
  CONSUMPTION: 'bg-orange-100 text-orange-800',
  WASTAGE: 'bg-red-100 text-red-800',
  RETURN_TO_SUPPLIER: 'bg-red-100 text-red-800',
  TRANSFER_OUT: 'bg-red-100 text-red-800',
  MANUAL_ADJUSTMENT: 'bg-blue-100 text-blue-800',
}

export function MovementBadge({ type }: { type: StockMovementType }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        MOVEMENT_STYLES[type],
      )}
    >
      {type.replace(/_/g, ' ')}
    </span>
  )
}

export function QtyDelta({ value }: { value: number }) {
  const n = Number(value)
  return (
    <span className={cn('font-medium', n >= 0 ? 'text-green-600' : 'text-red-600')}>
      {n >= 0 ? '+' : ''}
      {n}
    </span>
  )
}

// ─── PO status badge ────────────────────────────────────────────────
const PO_STATUS: Record<
  PurchaseOrderStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: 'Draft', className: 'bg-muted text-muted-foreground border' },
  ORDERED: { label: 'Ordered', className: 'bg-blue-100 text-blue-800' },
  PARTIALLY_RECEIVED: {
    label: 'Partially Received',
    className: 'bg-amber-100 text-amber-800',
  },
  RECEIVED: { label: 'Received', className: 'bg-green-100 text-green-800' },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800 line-through',
  },
}

export function POStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const cfg = PO_STATUS[status]
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  )
}
