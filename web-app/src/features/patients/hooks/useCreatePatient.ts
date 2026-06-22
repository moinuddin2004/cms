import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createPatient } from '../services/patients.api'
import { PATIENTS_QUERY_KEY } from './usePatients'

export function useCreatePatient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_QUERY_KEY] })
      toast.success('Patient created')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create patient')
    },
  })
}
