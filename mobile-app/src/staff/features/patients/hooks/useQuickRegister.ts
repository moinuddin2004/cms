import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { apiErrorMessage } from '@/core/http/api-error';

import { createPatient } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import type { CreatePatientInput, PatientDetail } from '../types/patients.types';

/** Create a patient; on success every cached patient list is refreshed and the new patient is returned. */
export function useQuickRegister() {
  const queryClient = useQueryClient();
  return useMutation<PatientDetail, unknown, CreatePatientInput>({
    mutationFn: (input) => createPatient(input),
    onSuccess: () => {
      // fire and forget: the caller must not wait for the list refetches
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not register the patient.')),
  });
}
