import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchPurchaseOrders,
  fetchPurchaseOrder,
  createPurchaseOrder,
  updatePOStatus,
  receivePOItems,
  cancelPO,
} from '../services/inventory.api'
import { INVENTORY_ITEMS_KEY, INVENTORY_STATS_KEY } from './useInventory'
import type {
  POFilterParams,
  CreatePOData,
  PurchaseOrderStatus,
  ReceivePOItem,
} from '../types'

export const PURCHASE_ORDERS_KEY = 'purchase-orders'

function getErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message || fallback
}

export function usePurchaseOrders(filters?: POFilterParams) {
  return useQuery({
    queryKey: [PURCHASE_ORDERS_KEY, filters],
    queryFn: () => fetchPurchaseOrders(filters),
    placeholderData: keepPreviousData,
  })
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: [PURCHASE_ORDERS_KEY, id],
    queryFn: () => fetchPurchaseOrder(id as string),
    enabled: !!id,
  })
}

export function useCreatePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePOData) => createPurchaseOrder(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PURCHASE_ORDERS_KEY] })
      toast.success('Purchase order created')
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to create PO')),
  })
}

export function useUpdatePOStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PurchaseOrderStatus }) =>
      updatePOStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PURCHASE_ORDERS_KEY] })
      toast.success('Status updated')
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to update status')),
  })
}

export function useReceivePOItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: ReceivePOItem[] }) =>
      receivePOItems(id, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PURCHASE_ORDERS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_ITEMS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_STATS_KEY] })
      toast.success('Items received and stock updated')
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to receive items')),
  })
}

export function useCancelPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelPO(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PURCHASE_ORDERS_KEY] })
      toast.success('Purchase order cancelled')
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to cancel PO')),
  })
}
