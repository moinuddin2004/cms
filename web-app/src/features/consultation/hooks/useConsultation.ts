import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { keys as patientKeys } from '@/features/patients/hooks/usePatientSubEntities'
import { queueError } from '@/features/queue/utils/queueError'
import {
  addEncounterTreatment,
  fetchProcedureCatalog,
  fetchWorkspace,
  fetchWorkspaceByQueueEntry,
} from '../services/consultation.api'
import type { TreatmentInput } from '../types'

export const CONSULTATION_KEY = 'consultation'
export const PROCEDURE_CATALOG_KEY = 'procedure-catalog'

/** The procedures a doctor can pick; an empty list means the clinic has no catalog yet. */
export function useProcedureCatalog() {
  return useQuery({
    queryKey: [PROCEDURE_CATALOG_KEY],
    queryFn: fetchProcedureCatalog,
    staleTime: 5 * 60_000,
  })
}

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
    mutationFn: (payload: TreatmentInput) =>
      addEncounterTreatment(encounterId, payload),
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
