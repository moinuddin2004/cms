import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../services/inventory.api'
import type { CategoryFormData } from '../types'

export const CATEGORIES_KEY = 'inventory-categories'

export function useCategories() {
  return useQuery({ queryKey: [CATEGORIES_KEY], queryFn: fetchCategories })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CategoryFormData) => createCategory(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CATEGORIES_KEY] })
      toast.success('Category created')
    },
    onError: () => toast.error('Failed to create category'),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<CategoryFormData> & { isActive?: boolean }
    }) => updateCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CATEGORIES_KEY] })
      toast.success('Category updated')
    },
    onError: () => toast.error('Failed to update category'),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CATEGORIES_KEY] })
      toast.success('Category deactivated')
    },
    onError: () => toast.error('Failed to deactivate category'),
  })
}
