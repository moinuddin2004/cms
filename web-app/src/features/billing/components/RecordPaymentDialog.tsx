import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { useRecordPayment } from '../hooks/usePayments'
import { PaymentMethod, REFERENCE_METHODS } from '../types'

export function RecordPaymentDialog({
  invoiceId,
  balanceDue,
}: {
  invoiceId: string
  balanceDue: number
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<number>(balanceDue)
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH)
  const [reference, setReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [notes, setNotes] = useState('')
  const { mutate, isPending } = useRecordPayment(invoiceId)

  const needsReference = REFERENCE_METHODS.includes(method)
  const invalid = !amount || amount <= 0 || amount > balanceDue + 0.001

  const submit = () => {
    mutate(
      {
        amount: Number(amount),
        paymentMethod: method,
        referenceNumber: needsReference ? reference || undefined : undefined,
        paymentDate,
        notes: notes || undefined,
      },
      { onSuccess: () => setOpen(false) },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setAmount(balanceDue)
      }}
    >
      <DialogTrigger asChild>
        <Button>Record Payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            Balance due:{' '}
            <span className="font-bold">{formatCurrency(balanceDue)}</span>
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            {invalid && (
              <p className="text-[11px] text-destructive">
                Amount must be between 1 and {balanceDue}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PaymentMethod).map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsReference && (
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transaction / cheque #"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending || invalid}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
