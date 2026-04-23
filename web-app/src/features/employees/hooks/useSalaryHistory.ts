import { useQuery } from '@tanstack/react-query'
import { fetchSalaryHistory } from '../services/employees.api'

export const SALARY_HISTORY_KEY = 'salary-history'

export function useSalaryHistory(employeeId: string) {
  return useQuery({
    queryKey: [SALARY_HISTORY_KEY, employeeId],
    queryFn: () => fetchSalaryHistory(employeeId),
    enabled: !!employeeId,
  })
}
