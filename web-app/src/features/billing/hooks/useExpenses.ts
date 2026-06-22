import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import * as api from '../services/billing.api'
import type { Expense, ExpenseCategory } from '../types'

const EXPENSES_KEY = 'expenses'
const EXPENSE_SUMMARY_KEY = 'expense-summary'

function errMsg(e: any, fb: string) {
  return e?.response?.data?.message || fb
}

export function useExpenses(params: {
  category?: ExpenseCategory
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: [EXPENSES_KEY, activeLocationId, params],
    queryFn: () => api.fetchExpenses(params),
    enabled: !!activeLocationId,
    placeholderData: (prev) => prev,
  })
}

export function useExpenseSummary(month: number, year: number) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: [EXPENSE_SUMMARY_KEY, activeLocationId, month, year],
    queryFn: () => api.fetchExpenseSummary(month, year),
    enabled: !!activeLocationId,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: [EXPENSES_KEY] })
    qc.invalidateQueries({ queryKey: [EXPENSE_SUMMARY_KEY] })
  }
}

export function useCreateExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.createExpense>[0]) =>
      api.createExpense(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Expense recorded')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to record expense')),
  })
}

export function useUpdateExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Expense> }) =>
      api.updateExpense(id, payload),
    onSuccess: () => {
      invalidate()
      toast.success('Expense updated')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to update expense')),
  })
}

export function useDeleteExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),
    onSuccess: () => {
      invalidate()
      toast.success('Expense deleted')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to delete expense')),
  })
}
