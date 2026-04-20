import { useQuery } from '@tanstack/react-query';
import { fetchPatientById } from '../services/patients.api';

export const PATIENT_QUERY_KEY = 'patient';

export function usePatient(id: string) {
  return useQuery({
    queryKey: [PATIENT_QUERY_KEY, id],
    queryFn: () => fetchPatientById(id),
    enabled: !!id,
  });
}
