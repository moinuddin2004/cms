import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPatient } from '../services/patients.api';
import { PATIENTS_QUERY_KEY } from './usePatients';

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_QUERY_KEY] });
    },
  });
}
