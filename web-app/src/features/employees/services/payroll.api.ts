import api from '@/lib/api'
import type {
  MarkPaidFormData,
  PayrollFormData,
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

export async function createPayroll(
  payload: PayrollFormData,
): Promise<PayrollRecord> {
  const { data } = await api.post('/payroll', payload)
  return data.data
}

export async function updatePayroll(
  recordId: string,
  payload: Partial<Omit<PayrollFormData, 'employeeId'>>,
): Promise<PayrollRecord> {
  const { data } = await api.patch(`/payroll/${recordId}`, payload)
  return data.data
}

export async function deletePayroll(recordId: string): Promise<void> {
  await api.delete(`/payroll/${recordId}`)
}

/** Saves a Blob response as a file. */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The month's payroll summary (base salary, commission, total) as CSV. */
export async function downloadPayrollCsv(
  month: number,
  year: number,
): Promise<void> {
  const res = await api.get('/payroll/export', {
    params: { month, year },
    responseType: 'blob',
    timeout: 60_000,
  })
  saveBlob(
    res.data as Blob,
    `payroll-${year}-${String(month).padStart(2, '0')}.csv`,
  )
}

/** Opens one record's payslip PDF in a new tab. */
export async function openPayslipPdf(recordId: string): Promise<void> {
  // Open the tab first (inside the click) so popup blockers allow it.
  const tab = window.open('', '_blank')
  try {
    const res = await api.get(`/payroll/${recordId}/payslip-pdf`, {
      responseType: 'blob',
      timeout: 60_000,
    })
    const url = URL.createObjectURL(res.data as Blob)
    if (tab) tab.location.href = url
    else saveBlob(res.data as Blob, `payslip-${recordId}.pdf`)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    tab?.close()
    throw err
  }
}
