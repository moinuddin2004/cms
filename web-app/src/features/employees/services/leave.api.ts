import api from '@/lib/api'
import type {
  EmployeeLeave,
  LeaveBalance,
  LeaveFilterParams,
  LeaveFormData,
} from '../types'

// ─── Leave Requests ─────────────────────────────────────────────────

export async function fetchLeaves(
  params: LeaveFilterParams = {},
): Promise<EmployeeLeave[]> {
  const { data } = await api.get('/leaves', { params })
  return data.data
}

export async function fetchLeaveBalance(
  employeeId: string,
): Promise<LeaveBalance> {
  const { data } = await api.get(`/leaves/balance/${employeeId}`)
  return data.data
}

export async function createLeave(
  payload: LeaveFormData & { employeeId: string },
): Promise<EmployeeLeave> {
  const { data } = await api.post('/leaves', payload)
  return data.data
}

export async function updateLeave(
  id: string,
  payload: Partial<LeaveFormData>,
): Promise<EmployeeLeave> {
  const { data } = await api.patch(`/leaves/${id}`, payload)
  return data.data
}

export async function approveLeave(
  id: string,
  reviewNote?: string,
): Promise<EmployeeLeave> {
  const { data } = await api.patch(`/leaves/${id}/approve`, { reviewNote })
  return data.data
}

export async function rejectLeave(
  id: string,
  reviewNote?: string,
): Promise<EmployeeLeave> {
  const { data } = await api.patch(`/leaves/${id}/reject`, { reviewNote })
  return data.data
}

export async function cancelLeave(id: string): Promise<EmployeeLeave> {
  const { data } = await api.patch(`/leaves/${id}/cancel`)
  return data.data
}
