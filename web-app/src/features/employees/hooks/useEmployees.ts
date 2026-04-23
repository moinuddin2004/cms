import { useQuery } from '@tanstack/react-query'
import { fetchEmployees } from '../services/employees.api'
import type { EmployeeListParams } from '../types'

export const EMPLOYEES_QUERY_KEY = 'employees'

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: [EMPLOYEES_QUERY_KEY, params],
    queryFn: () => fetchEmployees(params),
    placeholderData: (prev) => prev,
  })
}
