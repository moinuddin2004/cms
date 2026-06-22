import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchConsumptionTemplates,
  fetchTemplateByAppointmentType,
  createConsumptionTemplate,
  updateConsumptionTemplate,
  deleteConsumptionTemplate,
} from '../services/inventory.api'
import type { TemplateFormData } from '../types'

export const TEMPLATES_KEY = 'consumption-templates'

export function useConsumptionTemplates() {
  return useQuery({
    queryKey: [TEMPLATES_KEY],
    queryFn: fetchConsumptionTemplates,
  })
}

export function useTemplateByAppointmentType(type: string | undefined) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, 'by-type', type],
    queryFn: () => fetchTemplateByAppointmentType(type as string),
    enabled: !!type,
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TemplateFormData) =>
      createConsumptionTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATES_KEY] })
      toast.success('Template created')
    },
    onError: () => toast.error('Failed to create template'),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<TemplateFormData>
    }) => updateConsumptionTemplate(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATES_KEY] })
      toast.success('Template updated')
    },
    onError: () => toast.error('Failed to update template'),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteConsumptionTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATES_KEY] })
      toast.success('Template deactivated')
    },
    onError: () => toast.error('Failed to deactivate template'),
  })
}
