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
import { DatePicker } from '@/components/shared/DatePicker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateExpense } from '../hooks/useExpenses'
import { ExpenseCategory, PaymentMethod } from '../types'

export function ExpenseFormDialog() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory>(
    ExpenseCategory.SUPPLIES,
  )
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const { mutate, isPending } = useCreateExpense()

  const reset = () => {
    setCategory(ExpenseCategory.SUPPLIES)
    setDescription('')
    setAmount(0)
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setMethod(PaymentMethod.CASH)
    setReference('')
    setNotes('')
  }

  const submit = () => {
    if (!description.trim()) return toast.error('Description is required')
    if (!amount || amount <= 0) return toast.error('Enter a valid amount')
    mutate(
      {
        category,
        description: description.trim(),
        amount: Number(amount),
        expenseDate,
        paymentMethod: method,
        referenceNumber: reference || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          reset()
          setOpen(false)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Record Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                clearable={false}
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ExpenseCategory).map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly clinic rent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                value={expenseDate}
                onChange={(v) => setExpenseDate(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                clearable={false}
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
          </div>

          <div className="space-y-2">
            <Label>Reference (optional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
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
            <Button onClick={submit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Expense
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
