import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchItems,
  fetchItem,
  createItem,
  updateItem,
  deactivateItem,
  adjustStock,
  fetchStockMovements,
  fetchInventoryStats,
  fetchLowStockItems,
  fetchExpiringItems,
} from '../services/inventory.api'
import type { ItemFilterParams, ItemFormData, AdjustStockData } from '../types'

export const INVENTORY_ITEMS_KEY = 'inventory-items'
export const INVENTORY_STATS_KEY = 'inventory-stats'
export const LOW_STOCK_KEY = 'inventory-low-stock'
export const EXPIRING_KEY = 'inventory-expiring'
export const MOVEMENTS_KEY = 'inventory-movements'

function getErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message || fallback
}

export function useInventoryItems(filters: ItemFilterParams) {
  return useQuery({
    queryKey: [INVENTORY_ITEMS_KEY, filters],
    queryFn: () => fetchItems(filters),
    placeholderData: keepPreviousData,
  })
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: [INVENTORY_ITEMS_KEY, id],
    queryFn: () => fetchItem(id as string),
    enabled: !!id,
  })
}

export function useStockMovements(
  id: string | undefined,
  page = 1,
  limit = 20,
) {
  return useQuery({
    queryKey: [MOVEMENTS_KEY, id, page, limit],
    queryFn: () => fetchStockMovements(id as string, page, limit),
    enabled: !!id,
    placeholderData: keepPreviousData,
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ItemFormData) => createItem(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_ITEMS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_STATS_KEY] })
      toast.success('Item created')
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to create item')),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<ItemFormData>
    }) => updateItem(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_ITEMS_KEY] })
      toast.success('Item updated')
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to update item')),
  })
}

export function useDeactivateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivateItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_ITEMS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_STATS_KEY] })
      toast.success('Item deactivated')
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'Failed to deactivate item')),
  })
}

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdjustStockData }) =>
      adjustStock(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_ITEMS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_STATS_KEY] })
      qc.invalidateQueries({ queryKey: [LOW_STOCK_KEY] })
      qc.invalidateQueries({ queryKey: [MOVEMENTS_KEY] })
      toast.success('Stock adjusted')
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to adjust stock')),
  })
}

export function useInventoryStats() {
  return useQuery({
    queryKey: [INVENTORY_STATS_KEY],
    queryFn: fetchInventoryStats,
    staleTime: 60_000,
  })
}

export function useLowStockItems() {
  return useQuery({
    queryKey: [LOW_STOCK_KEY],
    queryFn: fetchLowStockItems,
  })
}

export function useExpiringItems(days?: number) {
  return useQuery({
    queryKey: [EXPIRING_KEY, days],
    queryFn: () => fetchExpiringItems(days),
  })
}
