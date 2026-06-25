import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createPrescriptionTemplate,
  deactivatePrescriptionTemplate,
  fetchDefaultPrescriptionTemplate,
  fetchPrescriptionTemplates,
  updatePrescriptionTemplate,
} from '../services/prescriptions.api'
import type { PrescriptionTemplate } from '../types'

export const PRESCRIPTION_TEMPLATES_KEY = 'prescription-templates'
export const PRESCRIPTION_TEMPLATE_DEFAULT_KEY = 'prescription-template-default'

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

export function usePrescriptionTemplates(locationId?: string) {
  return useQuery({
    queryKey: [PRESCRIPTION_TEMPLATES_KEY, locationId ?? null],
    queryFn: () => fetchPrescriptionTemplates(locationId),
  })
}

export function useDefaultPrescriptionTemplate(locationId?: string) {
  return useQuery({
    queryKey: [PRESCRIPTION_TEMPLATE_DEFAULT_KEY, locationId ?? null],
    queryFn: () => fetchDefaultPrescriptionTemplate(locationId),
  })
}

export function useCreatePrescriptionTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<PrescriptionTemplate>) =>
      createPrescriptionTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_TEMPLATES_KEY] })
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_TEMPLATE_DEFAULT_KEY] })
      toast.success('Prescription template saved')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save template')),
  })
}

export function useUpdatePrescriptionTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<PrescriptionTemplate>
    }) => updatePrescriptionTemplate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_TEMPLATES_KEY] })
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_TEMPLATE_DEFAULT_KEY] })
      toast.success('Prescription template updated')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to update template')),
  })
}

export function useDeactivatePrescriptionTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivatePrescriptionTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_TEMPLATES_KEY] })
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_TEMPLATE_DEFAULT_KEY] })
      toast.success('Template deactivated')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to deactivate template')),
  })
}
