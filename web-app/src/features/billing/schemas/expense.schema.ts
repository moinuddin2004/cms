import { z } from 'zod'
import { moneyField } from '@/lib/zod-numbers'
import { ExpenseCategory, PaymentMethod } from '../types'

/** Record an expense (mirrors CreateExpenseDto). Amount is edited as text. */
export const expenseFormSchema = z.object({
  category: z.enum(ExpenseCategory, 'Choose a category'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(300, 'At most 300 characters'),
  amount: moneyField('Amount').refine(
    (v) => Number(v) > 0,
    'Amount must be more than 0',
  ),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  paymentMethod: z.enum(PaymentMethod, 'Choose a payment method'),
  referenceNumber: z.string().trim().max(100, 'At most 100 characters'),
  notes: z.string(),
})

export type ExpenseFormValues = z.input<typeof expenseFormSchema>
