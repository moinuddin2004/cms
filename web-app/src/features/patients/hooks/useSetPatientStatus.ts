import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { setPatientStatus } from '../services/patients.api'
import { PATIENTS_QUERY_KEY } from './usePatients'
import { PATIENT_QUERY_KEY } from './usePatient'

export function useSetPatientStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setPatientStatus(id, isActive),
    onSuccess: (_data, { id, isActive }) => {
      toast.success(isActive ? 'Patient activated' : 'Patient deactivated')
      queryClient.invalidateQueries({ queryKey: [PATIENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [PATIENT_QUERY_KEY, id] })
    },
    onError: () => toast.error('Could not update patient status'),
  })
}
