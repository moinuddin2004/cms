import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
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
import { useMarkPaid } from '../hooks/useMarkPaid'
import {
  type MarkPaidFormData,
  PaymentMethod,
  PAYMENT_METHOD_OPTIONS,
} from '../types'
import { toast } from 'sonner'
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
  const markPaidMutation = useMarkPaid()

  const form = useForm({
    defaultValues: {
      paymentMethod: PaymentMethod.BANK_TRANSFER as string,
      paymentReference: '',
      notes: '',
    },
    onSubmit: async ({ value }) => {
      if (!record) return
      try {
        await markPaidMutation.mutateAsync({
          recordId: record.id,
          employeeId: record.employeeId,
          data: value as MarkPaidFormData,
        })
        toast.success('✅ Salary marked as paid')
        onOpenChange(false)
        form.reset()
      } catch {
        toast.error('Failed to mark as paid')
      }
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset()
    }
  }, [isOpen])

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
                  onValueChange={(val) => field.handleChange(val)}
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
            <Button type="submit" disabled={markPaidMutation.isPending}>
              {markPaidMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
