import { useQuery } from '@tanstack/react-query'
import { fetchEmployeeById } from '../services/employees.api'

export const EMPLOYEE_QUERY_KEY = 'employee'

export function useEmployee(id: string) {
  return useQuery({
    queryKey: [EMPLOYEE_QUERY_KEY, id],
    queryFn: () => fetchEmployeeById(id),
    enabled: !!id,
  })
}
