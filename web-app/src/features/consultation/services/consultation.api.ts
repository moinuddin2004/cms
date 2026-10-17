import api from '@/lib/api'
import type { Treatment } from '@/features/patients'
import type {
  ConsultationWorkspace,
  ProcedureOption,
  TreatmentInput,
  VisitNotes,
} from '../types'

export async function fetchWorkspace(
  encounterId: string,
): Promise<ConsultationWorkspace> {
  const { data } = await api.get(`/encounters/${encounterId}/workspace`)
  return data.data
}

/** Finds the consultation that was started for a queue entry. */
export async function fetchWorkspaceByQueueEntry(
  queueEntryId: string,
): Promise<ConsultationWorkspace> {
  const { data } = await api.get(`/encounters/by-queue-entry/${queueEntryId}`)
  return data.data
}

/** Saves the visit notes; an empty string clears a field. */
export async function saveVisitNotes(
  encounterId: string,
  notes: VisitNotes,
): Promise<void> {
  await api.patch(`/encounters/${encounterId}`, notes)
}

/** Active catalog procedures (id + name only — doctors never receive prices). */
export async function fetchProcedureCatalog(): Promise<ProcedureOption[]> {
  const { data } = await api.get('/treatments/catalog')
  return data.data
}

/** Records a treatment done in this visit; billing prices it from the service. */
export async function addEncounterTreatment(
  encounterId: string,
  input: TreatmentInput,
): Promise<Treatment> {
  const { data } = await api.post(
    `/encounters/${encounterId}/treatments`,
    input,
  )
  return data.data
}
