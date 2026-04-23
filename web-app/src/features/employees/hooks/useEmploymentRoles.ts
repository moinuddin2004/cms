import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import type { EmploymentRole } from '../types'

export const EMPLOYMENT_ROLES_QUERY_KEY = 'employment-roles'

export function useEmploymentRoles() {
  return useQuery<EmploymentRole[]>({
    queryKey: [EMPLOYMENT_ROLES_QUERY_KEY],
    queryFn: async () => {
      const res = await apiClient.get('/employment-roles')
      return res.data.data
    },
  })
}
