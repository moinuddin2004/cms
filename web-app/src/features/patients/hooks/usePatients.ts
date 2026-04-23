import { useQuery } from '@tanstack/react-query'
import { fetchPatients } from '../services/patients.api'
import type { PatientListParams } from '../types'

export const PATIENTS_QUERY_KEY = 'patients'

export function usePatients(params: PatientListParams) {
  return useQuery({
    queryKey: [PATIENTS_QUERY_KEY, params],
    queryFn: () => fetchPatients(params),
    placeholderData: (prev) => prev, // Keep previous data while refetching
  })
}
