import api from '@/lib/api'
import type {
  MarkPaidFormData,
  PayrollRecord,
  LocationPayrollResponse,
  GeneratePayrollResult,
} from '../types'

// ─── Payroll ────────────────────────────────────────────────────────

export async function fetchEmployeePayroll(
  employeeId: string,
): Promise<PayrollRecord[]> {
  const { data } = await api.get(`/payroll/employee/${employeeId}`)
  return data.data
}

export async function fetchLocationPayroll(
  month: number,
  year: number,
): Promise<LocationPayrollResponse> {
  const { data } = await api.get('/payroll/location', {
    params: { month, year },
  })
  return data.data
}

export async function generatePayroll(payload: {
  month: number
  year: number
}): Promise<GeneratePayrollResult> {
  const { data } = await api.post('/payroll/generate', payload)
  return data.data
}

export async function markPayrollPaid(
  recordId: string,
  payload: MarkPaidFormData,
): Promise<void> {
  await api.patch(`/payroll/${recordId}/mark-paid`, payload)
}

export async function markPayrollOnHold(recordId: string): Promise<void> {
  await api.patch(`/payroll/${recordId}/mark-on-hold`)
}
