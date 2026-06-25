import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createMedicine,
  deactivateMedicine,
  fetchMedicines,
  searchMedicines,
  seedCommonMedicines,
  updateMedicine,
} from '../services/prescriptions.api'
import type { MedicineDirectoryItem, MedicineType } from '../types'

export const MEDICINES_KEY = 'medicine-directory'

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

export function useMedicines() {
  return useQuery({
    queryKey: [MEDICINES_KEY],
    queryFn: () => fetchMedicines(),
  })
}

/**
 * Debounced server search — used by the prescription builder's autocomplete.
 * Only fires when `query` has ≥ 2 chars. Returns `[]` until then.
 */
export function useMedicineSearch(query: string, type?: MedicineType) {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  return useQuery({
    queryKey: [MEDICINES_KEY, 'search', debounced, type],
    queryFn: () =>
      debounced.length >= 2 ? searchMedicines(debounced, type) : Promise.resolve([]),
    enabled: debounced.length >= 2,
    placeholderData: (prev) => prev,
  })
}

export function useCreateMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<MedicineDirectoryItem>) =>
      createMedicine(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MEDICINES_KEY] })
      toast.success('Medicine added')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to add medicine')),
  })
}

export function useUpdateMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<MedicineDirectoryItem>
    }) => updateMedicine(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MEDICINES_KEY] })
      toast.success('Medicine updated')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to update medicine')),
  })
}

export function useDeactivateMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivateMedicine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MEDICINES_KEY] })
      toast.success('Medicine deactivated')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to deactivate medicine')),
  })
}

export function useSeedCommonMedicines() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => seedCommonMedicines(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [MEDICINES_KEY] })
      toast.success(
        res.skipped
          ? 'Directory already has medicines'
          : `Seeded ${res.seeded} common medicines`,
      )
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to seed medicines')),
  })
}
