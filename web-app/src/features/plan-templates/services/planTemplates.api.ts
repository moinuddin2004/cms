import api from '@/lib/api'
import type { PlanTemplate, PlanTemplateInput } from '../types'

export async function fetchPlanTemplates(
  includeInactive = false,
): Promise<PlanTemplate[]> {
  const { data } = await api.get('/plan-templates', {
    params: includeInactive ? { includeInactive: true } : undefined,
  })
  return data.data
}

export async function createPlanTemplate(
  payload: PlanTemplateInput,
): Promise<PlanTemplate> {
  const { data } = await api.post('/plan-templates', payload)
  return data.data
}

export async function updatePlanTemplate(
  id: string,
  payload: Partial<PlanTemplateInput> & { isActive?: boolean },
): Promise<PlanTemplate> {
  const { data } = await api.patch(`/plan-templates/${id}`, payload)
  return data.data
}

export async function deletePlanTemplate(id: string): Promise<void> {
  await api.delete(`/plan-templates/${id}`)
}
