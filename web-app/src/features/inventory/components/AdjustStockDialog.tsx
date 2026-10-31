import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/shared/DatePicker'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
import { Loader2 } from 'lucide-react'
import { useAdjustStockForm } from '../hooks/useAdjustStockForm'
import { notesRequiredFor, signedAdjustment } from '../schemas/inventory.schema'
import type { AdjustMovementType } from '../schemas/inventory.schema'
import type { InventoryItem } from '../types'

interface AdjustStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem | null
}

const REASONS: { value: AdjustMovementType; label: string }[] = [
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
  const { form, current } = useAdjustStockForm({
    open,
    item,
    onDone: () => onOpenChange(false),
  })

  if (!item) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock — {item.name}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="movementType">
            {(f) => (
              <FieldWrapper label="Reason" error={fieldError(f)}>
                <Select
                  clearable={false}
                  value={f.state.value}
                  onValueChange={(v) => f.handleChange(v as AdjustMovementType)}
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
              </FieldWrapper>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.movementType}>
            {(movementType) => {
              const isManual = movementType === 'MANUAL_ADJUSTMENT'
              return (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <form.Field name="quantity">
                      {(f) => (
                        <FieldWrapper
                          label="Quantity"
                          htmlFor="adjust-quantity"
                          error={fieldError(f)}
                        >
                          <NumberInput
                            id="adjust-quantity"
                            mode="decimal"
                            value={f.state.value}
                            onChange={(e) => f.handleChange(e.target.value)}
                            onBlur={f.handleBlur}
                            aria-invalid={!!fieldError(f)}
                          />
                        </FieldWrapper>
                      )}
                    </form.Field>
                    {isManual && (
                      <form.Field name="direction">
                        {(f) => (
                          <FieldWrapper label="Direction">
                            <Select
                              clearable={false}
                              value={f.state.value}
                              onValueChange={(v) =>
                                f.handleChange(v as 'increase' | 'decrease')
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="increase">
                                  Increase (+)
                                </SelectItem>
                                <SelectItem value="decrease">
                                  Decrease (−)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FieldWrapper>
                        )}
                      </form.Field>
                    )}
                  </div>

                  {(movementType === 'TRANSFER_IN' || isManual) && (
                    <div className="grid grid-cols-2 gap-4">
                      <form.Field name="batchNumber">
                        {(f) => (
                          <FieldWrapper
                            label="Batch Number"
                            htmlFor="adjust-batch"
                            error={fieldError(f)}
                          >
                            <Input
                              id="adjust-batch"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                              onBlur={f.handleBlur}
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                      <form.Field name="expiryDate">
                        {(f) => (
                          <FieldWrapper label="Expiry Date">
                            <DatePicker
                              value={f.state.value}
                              onChange={(v) => f.handleChange(v)}
                              clearable
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                    </div>
                  )}

                  <form.Field name="notes">
                    {(f) => (
                      <FieldWrapper
                        label="Notes"
                        htmlFor="adjust-notes"
                        required={notesRequiredFor(movementType)}
                        error={fieldError(f)}
                      >
                        <Textarea
                          id="adjust-notes"
                          className="h-16 resize-none"
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          onBlur={f.handleBlur}
                          aria-invalid={!!fieldError(f)}
                        />
                      </FieldWrapper>
                    )}
                  </form.Field>
                </>
              )
            }}
          </form.Subscribe>

          <form.Subscribe
            selector={(s) => current + signedAdjustment(s.values)}
          >
            {(projected) => (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                Current: <span className="font-semibold">{current}</span> → New:{' '}
                <span
                  className={
                    projected < 0
                      ? 'font-semibold text-red-600'
                      : 'font-semibold'
                  }
                >
                  {projected}
                </span>{' '}
                {item.unit}
              </div>
            )}
          </form.Subscribe>

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
                  Save Adjustment
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  )
}
