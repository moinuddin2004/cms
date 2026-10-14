import type { Encounter } from '@/features/patients'
import type { EntryStatus } from '@/features/queue/types'

/** The queue entry behind the consultation — needed to Complete the visit. */
export interface ConsultationQueueEntry {
  id: string
  /** Display token, e.g. "A-007". */
  token: string
  status: EntryStatus
  version: number
  sessionId: string
}

/** One call loads everything the consultation screen needs about the visit. */
export interface ConsultationWorkspace {
  encounter: Encounter
  queueEntry: ConsultationQueueEntry | null
  doctor: { id: string; fullName: string } | null
}

/** The doctor's notes for the visit — the fields that auto-save. */
export interface VisitNotes {
  chiefComplaint: string
  examination: string
  diagnosis: string
  advice: string
  /** `yyyy-MM-dd` or '' when no follow-up is planned. */
  followUpDate: string
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
