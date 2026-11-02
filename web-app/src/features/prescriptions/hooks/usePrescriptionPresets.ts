import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createPrescriptionPreset,
  deactivatePrescriptionPreset,
  fetchPrescriptionPreset,
  fetchPrescriptionPresets,
  updatePrescriptionPreset,
} from '../services/prescriptions.api'
import type { PrescriptionPreset } from '../types'

export const PRESCRIPTION_PRESETS_KEY = 'prescription-presets'

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

export function usePrescriptionPresets(category?: string) {
  return useQuery({
    queryKey: [PRESCRIPTION_PRESETS_KEY, category ?? null],
    queryFn: () => fetchPrescriptionPresets(category),
  })
}

export function usePrescriptionPreset(id: string | undefined) {
  return useQuery({
    queryKey: [PRESCRIPTION_PRESETS_KEY, id],
    queryFn: () => fetchPrescriptionPreset(id!),
    enabled: !!id,
  })
}

export function useCreatePrescriptionPreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<PrescriptionPreset>) =>
      createPrescriptionPreset(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_PRESETS_KEY] })
      toast.success('Prescription preset saved')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save prescription preset')),
  })
}

export function useUpdatePrescriptionPreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<PrescriptionPreset>
    }) => updatePrescriptionPreset(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_PRESETS_KEY] })
      toast.success('Prescription preset updated')
    },
    onError: (err) =>
      toast.error(errMsg(err, 'Failed to update prescription preset')),
  })
}

export function useDeactivatePrescriptionPreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivatePrescriptionPreset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_PRESETS_KEY] })
      toast.success('Prescription preset deactivated')
    },
    onError: (err) =>
      toast.error(errMsg(err, 'Failed to deactivate prescription preset')),
  })
}
