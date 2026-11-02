import { useForm } from '@tanstack/react-form'
import { todayYmd } from '@/lib/datetime'
import { expenseFormSchema } from '../schemas/expense.schema'
import type { ExpenseFormValues } from '../schemas/expense.schema'
import { ExpenseCategory, PaymentMethod } from '../types'
import { useCreateExpense } from './useExpenses'

export const expenseDefaults = (): ExpenseFormValues => ({
  category: ExpenseCategory.SUPPLIES,
  description: '',
  amount: '',
  expenseDate: todayYmd(),
  paymentMethod: PaymentMethod.CASH,
  referenceNumber: '',
  notes: '',
})

/** Record a new expense; `onDone` runs after a successful save. */
export function useExpenseForm({ onDone }: { onDone: () => void }) {
  const create = useCreateExpense()
  const form = useForm({
    defaultValues: expenseDefaults(),
    validators: { onChange: expenseFormSchema, onSubmit: expenseFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await create.mutateAsync({
          category: value.category,
          description: value.description.trim(),
          amount: Number(value.amount),
          expenseDate: value.expenseDate,
          paymentMethod: value.paymentMethod,
          referenceNumber: value.referenceNumber || undefined,
          notes: value.notes || undefined,
        })
        onDone()
      } catch {
        // Toasted by useCreateExpense's onError.
      }
    },
  })
  return form
}
