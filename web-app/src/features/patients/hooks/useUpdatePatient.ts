import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updatePatient } from '../services/patients.api'
import { PATIENTS_QUERY_KEY } from './usePatients'
import { PATIENT_QUERY_KEY } from './usePatient'
import type { PatientFormData } from '../types'

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: PatientFormData) => updatePatient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [PATIENT_QUERY_KEY, id] })
    },
  })
}
