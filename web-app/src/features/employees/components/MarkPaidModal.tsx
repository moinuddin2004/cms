import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { fieldError } from '@/components/forms/fieldError'
import { useMarkPaidForm } from '../hooks/useMarkPaidForm'
import { PAYMENT_METHOD_OPTIONS } from '../types'
import type { PaymentMethod } from '../types'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'

interface MarkPaidModalProps {
  record: {
    id: string
    employeeId: string
    periodLabel: string
    salaryAmount: number
  } | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function MarkPaidModal({
  record,
  isOpen,
  onOpenChange,
}: MarkPaidModalProps) {
  const { form, isPending } = useMarkPaidForm({
    record,
    isOpen,
    onDone: () => onOpenChange(false),
  })

  if (!record) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark Salary as Paid</DialogTitle>
          <DialogDescription>
            {record.periodLabel} · {formatCurrency(record.salaryAmount)}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 py-4"
        >
          <form.Field name="paymentMethod">
            {(field) => (
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) =>
                    field.handleChange(val as PaymentMethod)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError(field) && (
                  <p className="text-xs text-destructive">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.paymentMethod}>
            {(paymentMethod) =>
              paymentMethod === 'bank_transfer' ? (
                <form.Field name="paymentReference">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>Reference Number</Label>
                      <Input
                        placeholder="Transaction ID or reference"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>

          <form.Field name="notes">
            {(field) => (
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Any additional notes"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={isPending || !canSubmit || isSubmitting}
                >
                  {(isPending || isSubmitting) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirm Payment
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
