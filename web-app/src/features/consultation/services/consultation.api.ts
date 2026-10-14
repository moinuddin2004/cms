import api from '@/lib/api'
import type { ConsultationWorkspace, VisitNotes } from '../types'

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
