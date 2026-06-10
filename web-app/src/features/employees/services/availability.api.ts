import api from '@/lib/api'
import type { AvailabilityOverride, OverrideFormData } from '../types'

// ─── Doctor Availability Overrides ──────────────────────────────────

export async function fetchOverrides(
  employeeId: string,
  params: { from?: string; to?: string } = {},
): Promise<AvailabilityOverride[]> {
  const { data } = await api.get(
    `/employees/${employeeId}/availability-overrides`,
    { params },
  )
  return data.data
}

export async function createOverride(
  employeeId: string,
  payload: OverrideFormData,
): Promise<AvailabilityOverride> {
  const { data } = await api.post(
    `/employees/${employeeId}/availability-overrides`,
    payload,
  )
  return data.data
}

export async function updateOverride(
  employeeId: string,
  id: string,
  payload: Partial<OverrideFormData>,
): Promise<AvailabilityOverride> {
  const { data } = await api.patch(
    `/employees/${employeeId}/availability-overrides/${id}`,
    payload,
  )
  return data.data
}

export async function deleteOverride(
  employeeId: string,
  id: string,
): Promise<void> {
  await api.delete(`/employees/${employeeId}/availability-overrides/${id}`)
}
