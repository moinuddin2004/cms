import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../services/inventory.api'
import type { SupplierFormData } from '../types'

export const SUPPLIERS_KEY = 'inventory-suppliers'

export function useSuppliers() {
  return useQuery({ queryKey: [SUPPLIERS_KEY], queryFn: fetchSuppliers })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SupplierFormData) => createSupplier(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
      toast.success('Supplier created')
    },
    onError: () => toast.error('Failed to create supplier'),
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<SupplierFormData>
    }) => updateSupplier(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
      toast.success('Supplier updated')
    },
    onError: () => toast.error('Failed to update supplier'),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
      toast.success('Supplier deactivated')
    },
    onError: () => toast.error('Failed to deactivate supplier'),
  })
}
