import apiClient from '@/lib/api'

export const payrollApi = {
  generate: (data: { month: number; year: number; locationId: string }) =>
    apiClient.post('/payroll/generate', data),

  getByEmployee: (employeeId: string) =>
    apiClient.get(`/payroll/employee/${employeeId}`),

  markPaid: (
    recordId: string,
    data: {
      paymentMethod: string
      paymentReference?: string
      notes?: string
    },
  ) => apiClient.patch(`/payroll/${recordId}/mark-paid`, data),

  markOnHold: (recordId: string) =>
    apiClient.patch(`/payroll/${recordId}/mark-on-hold`),
}
