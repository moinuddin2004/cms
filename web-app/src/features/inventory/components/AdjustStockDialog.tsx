import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdjustStock } from '../hooks/useInventory'
import type { InventoryItem, StockMovementType } from '../types'

interface AdjustStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem | null
}

const REASONS: { value: StockMovementType; label: string }[] = [
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment' },
  { value: 'WASTAGE', label: 'Wastage' },
  { value: 'RETURN_TO_SUPPLIER', label: 'Return to Supplier' },
  { value: 'TRANSFER_IN', label: 'Transfer In' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out' },
]

export function AdjustStockDialog({
  open,
  onOpenChange,
  item,
}: AdjustStockDialogProps) {
  const adjustMutation = useAdjustStock()
  const [movementType, setMovementType] =
    useState<StockMovementType>('MANUAL_ADJUSTMENT')
  const [quantity, setQuantity] = useState(0)
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setMovementType('MANUAL_ADJUSTMENT')
      setQuantity(0)
      setDirection('increase')
      setBatchNumber('')
      setExpiryDate('')
      setNotes('')
    }
  }, [open])

  if (!item) return null

  const current = Number(item.currentStock)
  const isManual = movementType === 'MANUAL_ADJUSTMENT'
  const isOut =
    movementType === 'WASTAGE' ||
    movementType === 'RETURN_TO_SUPPLIER' ||
    movementType === 'TRANSFER_OUT'

  // Compute signed delta for preview
  let signedDelta = Math.abs(quantity)
  if (isManual) signedDelta = direction === 'decrease' ? -Math.abs(quantity) : Math.abs(quantity)
  else if (isOut) signedDelta = -Math.abs(quantity)
  const projected = current + signedDelta

  const notesRequired = movementType === 'WASTAGE' || isManual

  const submit = () => {
    if (!quantity || quantity <= 0) {
      toast.error('Enter a quantity greater than zero')
      return
    }
    if (notesRequired && !notes.trim()) {
      toast.error('Notes are required for this adjustment type')
      return
    }
    if (projected < 0) {
      toast.error('Adjustment would take stock below zero')
      return
    }

    // For MANUAL_ADJUSTMENT we send the signed quantity; others send positive.
    const payloadQuantity = isManual
      ? direction === 'decrease'
        ? -Math.abs(quantity)
        : Math.abs(quantity)
      : Math.abs(quantity)

    adjustMutation.mutate(
      {
        id: item.id,
        payload: {
          quantity: payloadQuantity,
          movementType,
          batchNumber: batchNumber.trim() || undefined,
          expiryDate: expiryDate || undefined,
          notes: notes.trim() || undefined,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock — {item.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select
              value={movementType}
              onValueChange={(v) => setMovementType(v as StockMovementType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            {isManual && (
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={direction}
                  onValueChange={(v) =>
                    setDirection(v as 'increase' | 'decrease')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase (+)</SelectItem>
                    <SelectItem value="decrease">Decrease (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {(movementType === 'TRANSFER_IN' || isManual) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Batch Number</Label>
                <Input
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Notes{' '}
              {notesRequired && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              className="h-16 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm">
            Current: <span className="font-semibold">{current}</span> → New:{' '}
            <span
              className={
                projected < 0 ? 'font-semibold text-red-600' : 'font-semibold'
              }
            >
              {projected}
            </span>{' '}
            {item.unit}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={adjustMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={adjustMutation.isPending}>
              {adjustMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Adjustment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
