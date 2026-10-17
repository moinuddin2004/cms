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

/** A procedure the doctor can pick — name only, prices stay in billing. */
export interface ProcedureOption {
  id: string
  name: string
  code: string | null
}

/** What the doctor sends when recording a treatment: a service or a typed name, never a fee. */
export interface TreatmentInput {
  serviceId?: string
  treatmentName?: string
  notes?: string
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
