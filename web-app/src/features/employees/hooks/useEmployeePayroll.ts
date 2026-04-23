import { useQuery } from '@tanstack/react-query'
import { fetchEmployeePayroll } from '../services/payroll.api'

export const PAYROLL_KEY = 'payroll'

export function useEmployeePayroll(employeeId: string) {
  return useQuery({
    queryKey: [PAYROLL_KEY, employeeId],
    queryFn: () => fetchEmployeePayroll(employeeId),
    enabled: !!employeeId,
  })
}
