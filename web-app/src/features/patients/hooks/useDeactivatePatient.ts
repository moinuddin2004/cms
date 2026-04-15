import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deactivatePatient } from '../services/patients.api';
import { PATIENTS_QUERY_KEY } from './usePatients';
import { PATIENT_QUERY_KEY } from './usePatient';

export function useDeactivatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deactivatePatient,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PATIENT_QUERY_KEY, id] });
    },
  });
}
