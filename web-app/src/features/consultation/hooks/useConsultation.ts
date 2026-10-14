import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { createEncounterTreatment } from '@/features/patients/services/patients.api'
import type { TreatmentFormData } from '@/features/patients/types'
import { keys as patientKeys } from '@/features/patients/hooks/usePatientSubEntities'
import { queueError } from '@/features/queue/utils/queueError'
import {
  fetchWorkspace,
  fetchWorkspaceByQueueEntry,
} from '../services/consultation.api'

export const CONSULTATION_KEY = 'consultation'

export function useWorkspace(encounterId: string) {
  return useQuery({
    queryKey: [CONSULTATION_KEY, encounterId],
    queryFn: () => fetchWorkspace(encounterId),
    enabled: !!encounterId,
  })
}

/** Opens the consultation screen for a patient the doctor already started. */
export function useOpenConsultation() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (queueEntryId: string) =>
      fetchWorkspaceByQueueEntry(queueEntryId),
    onSuccess: (workspace) => {
      void navigate({
        to: '/consultation/$encounterId',
        params: { encounterId: workspace.encounter.id },
      })
    },
    onError: (err) => toast.error(queueError(err).message),
  })
}

/** Records a treatment done in this visit (shows up on the patient's history too). */
export function useAddTreatment(encounterId: string, patientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: TreatmentFormData) =>
      createEncounterTreatment(encounterId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [CONSULTATION_KEY, encounterId],
      })
      void queryClient.invalidateQueries({
        queryKey: patientKeys.treatments(patientId),
      })
      void queryClient.invalidateQueries({
        queryKey: patientKeys.history(patientId),
      })
    },
    onError: (err) => toast.error(queueError(err).message),
  })
}
