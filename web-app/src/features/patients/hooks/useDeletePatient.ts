import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deletePatient } from '../services/patients.api'
import { PATIENTS_QUERY_KEY } from './usePatients'
import { PATIENT_QUERY_KEY } from './usePatient'

export function useDeletePatient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePatient,
    onSuccess: (_data, id) => {
      toast.success('Patient deleted permanently')
      queryClient.invalidateQueries({ queryKey: [PATIENTS_QUERY_KEY] })
      queryClient.removeQueries({ queryKey: [PATIENT_QUERY_KEY, id] })
    },
    onError: () => toast.error('Could not delete patient'),
  })
}
