import { useForm } from '@tanstack/react-form'
import { todayYmd } from '@/lib/datetime'
import { expenseFormSchema } from '../schemas/expense.schema'
import type { ExpenseFormValues } from '../schemas/expense.schema'
import { ExpenseCategory, PaymentMethod } from '../types'
import type { Expense } from '../types'
import { useCreateExpense, useUpdateExpense } from './useExpenses'

export const expenseDefaults = (): ExpenseFormValues => ({
  category: ExpenseCategory.SUPPLIES,
  description: '',
  amount: '',
  expenseDate: todayYmd(),
  paymentMethod: PaymentMethod.CASH,
  referenceNumber: '',
  notes: '',
})

/** An existing expense as form values (for editing). */
export const expenseValues = (e: Expense): ExpenseFormValues => ({
  category: e.category,
  description: e.description,
  amount: String(e.amount),
  expenseDate: e.expenseDate.slice(0, 10),
  paymentMethod: e.paymentMethod,
  referenceNumber: e.referenceNumber ?? '',
  notes: e.notes ?? '',
})

/**
 * Record a new expense, or edit `expense` when given; `onDone` runs after a
 * successful save.
 */
export function useExpenseForm({
  expense,
  onDone,
}: {
  expense?: Expense | null
  onDone: () => void
}) {
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const form = useForm({
    defaultValues: expense ? expenseValues(expense) : expenseDefaults(),
    validators: { onChange: expenseFormSchema, onSubmit: expenseFormSchema },
    onSubmit: async ({ value }) => {
      const payload = {
        category: value.category,
        description: value.description.trim(),
        amount: Number(value.amount),
        expenseDate: value.expenseDate,
        paymentMethod: value.paymentMethod,
      }
      try {
        if (expense) {
          await update.mutateAsync({
            id: expense.id,
            payload: {
              ...payload,
              referenceNumber: value.referenceNumber || null,
              notes: value.notes || null,
            },
          })
        } else {
          await create.mutateAsync({
            ...payload,
            referenceNumber: value.referenceNumber || undefined,
            notes: value.notes || undefined,
          })
        }
        onDone()
      } catch {
        // Toasted by the mutation's onError.
      }
    },
  })
  return form
}
