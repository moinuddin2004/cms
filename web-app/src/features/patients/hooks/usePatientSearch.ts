import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchPatients } from '../services/patients.api'
import { PATIENTS_QUERY_KEY } from './usePatients'

/**
 * Type-ahead patient lookup (name, phone, patient number) for pickers in
 * other features. Debounced 300 ms; does nothing until 2+ characters.
 */
export function usePatientSearch(query: string, limit = 8) {
  const q = useDebounce(query.trim(), 300)
  const enabled = q.length >= 2
  const result = useQuery({
    queryKey: [PATIENTS_QUERY_KEY, 'search', q, limit],
    queryFn: () => fetchPatients({ search: q, limit }),
    enabled,
    staleTime: 30_000,
  })
  return {
    patients: enabled ? (result.data?.data ?? []) : [],
    isSearching: enabled && result.isFetching,
    isActive: enabled,
  }
}
