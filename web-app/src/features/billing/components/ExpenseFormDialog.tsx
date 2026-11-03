import { useEffect, useState } from 'react'
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
import { Loader2, Plus } from 'lucide-react'
import {
  expenseDefaults,
  expenseValues,
  useExpenseForm,
} from '../hooks/useExpenseForm'
import { ExpenseCategory, PaymentMethod } from '../types'
import type { Expense } from '../types'

/**
 * Without `expense`: an "Add Expense" button that opens an empty form.
 * With `expense` (controlled by the caller, no trigger): edits it.
 */
export function ExpenseFormDialog({
  expense,
  onClose,
}: {
  expense?: Expense | null
  onClose?: () => void
} = {}) {
  const editing = expense !== undefined
  const [ownOpen, setOwnOpen] = useState(false)
  const open = editing ? !!expense : ownOpen
  const close = () => (editing ? onClose?.() : setOwnOpen(false))
  const form = useExpenseForm({
    expense,
    onDone: () => {
      form.reset(expenseDefaults())
      close()
    },
  })
  useEffect(() => {
    if (expense) form.reset(expenseValues(expense))
  }, [expense?.id])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setOwnOpen(true)
        else {
          close()
          form.reset(expenseDefaults())
        }
      }}
    >
      {!editing && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Expense' : 'Record Expense'}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="category">
              {(field) => (
                <FieldWrapper label="Category" error={fieldError(field)}>
                  <Select
                    clearable={false}
                    value={field.state.value}
                    onValueChange={(v) =>
                      field.handleChange(v as ExpenseCategory)
                    }
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
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="amount">
              {(field) => (
                <FieldWrapper
                  label="Amount"
                  htmlFor="expense-amount"
                  error={fieldError(field)}
                >
                  <NumberInput
                    id="expense-amount"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>

          <form.Field name="description">
            {(field) => (
              <FieldWrapper
                label="Description"
                htmlFor="expense-description"
                error={fieldError(field)}
              >
                <Input
                  id="expense-description"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g. Monthly clinic rent"
                />
              </FieldWrapper>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="expenseDate">
              {(field) => (
                <FieldWrapper label="Date" error={fieldError(field)}>
                  <DatePicker
                    value={field.state.value}
                    onChange={(v) => {
                      field.handleChange(v)
                      field.handleBlur()
                    }}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="paymentMethod">
              {(field) => (
                <FieldWrapper label="Payment Method" error={fieldError(field)}>
                  <Select
                    clearable={false}
                    value={field.state.value}
                    onValueChange={(v) =>
                      field.handleChange(v as PaymentMethod)
                    }
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
                </FieldWrapper>
              )}
            </form.Field>
          </div>

          <form.Field name="referenceNumber">
            {(field) => (
              <FieldWrapper
                label="Reference (optional)"
                htmlFor="expense-reference"
                error={fieldError(field)}
              >
                <Input
                  id="expense-reference"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <FieldWrapper label="Notes" htmlFor="expense-notes">
                <Textarea
                  id="expense-notes"
                  className="h-16 resize-none"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                close()
                form.reset(expenseDefaults())
              }}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Expense
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
