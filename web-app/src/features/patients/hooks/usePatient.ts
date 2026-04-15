import { useQuery } from '@tanstack/react-query';
import { fetchPatient } from '../services/patients.api';

export const PATIENT_QUERY_KEY = 'patient';

export function usePatient(id: string) {
  return useQuery({
    queryKey: [PATIENT_QUERY_KEY, id],
    queryFn: () => fetchPatient(id),
    enabled: !!id,
  });
}
