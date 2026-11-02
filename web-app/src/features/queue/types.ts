// ─── Enums (match backend, lowercase snake_case) ─────────────────────

export type QueueType = 'appointment' | 'walk_in'

export type EntryStatus =
  | 'waiting'
  | 'called'
  | 'in_consultation'
  | 'on_hold'
  | 'skipped'
  | 'completed'
  | 'cancelled'
  | 'transferred'
  | 'aborted'

export type SessionStatus = 'waiting_for_doctor' | 'open' | 'paused' | 'closed'

export type RejoinPolicy = 'end' | 'original_position' | 'manual'

export type SelectionReason =
  | 'URGENT'
  | 'STARVATION_GUARD'
  | 'APPOINTMENT_DUE'
  | 'RETURNED_FROM_TEST'
  | 'FIFO'
  | 'MANUAL_SELECT'

export const ACTIVE_STATUSES: EntryStatus[] = [
  'waiting',
  'called',
  'in_consultation',
  'on_hold',
  'skipped',
]

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  waiting: 'Waiting',
  called: 'Called',
  in_consultation: 'In room',
  on_hold: 'At test',
  skipped: 'Skipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
  transferred: 'Transferred',
  aborted: 'Stopped',
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  waiting_for_doctor: 'Doctor not started',
  open: 'Open',
  paused: 'Paused',
  closed: 'Closed',
}

export const REASON_LABELS: Record<SelectionReason, string> = {
  URGENT: 'Emergency',
  STARVATION_GUARD: 'Waited too long',
  APPOINTMENT_DUE: 'Appointment due',
  RETURNED_FROM_TEST: 'Back from test',
  FIFO: 'Next in line',
  MANUAL_SELECT: 'Chosen by doctor',
}

// ─── API shapes ─────────────────────────────────────────────────────

export interface QueuePatient {
  id: string
  fullName: string
  phone: string | null
  patientNumber: string | null
}

export interface QueueEntry {
  id: string
  sessionId: string
  /** Display token, e.g. "A-007". */
  token: string
  tokenNumber: number
  queueType: QueueType
  status: EntryStatus
  priorityClass: 'normal' | 'authorized_urgent'
  urgentReason: string | null
  urgentSince: string | null
  patient: QueuePatient | null
  appointmentId: string | null
  scheduledStart: string | null
  reasonForVisit: string | null
  checkedInAt: string
  sortAnchorAt: string
  calledAt: string | null
  consultationStartedAt: string | null
  holdStartedAt: string | null
  returnedFromHoldAt: string | null
  skippedAt: string | null
  finishedAt: string | null
  convertedFromApptId: string | null
  transferredFromId: string | null
  version: number
}

export interface QueueSession {
  id: string
  organizationId: string
  locationId: string
  doctorId: string
  doctorName: string | null
  serviceDate: string
  status: SessionStatus
  tokenPrefix: string
  smartQueueEnabled: boolean
  pauseReason: string | null
  startedAt: string | null
  closedAt: string | null
  lastCallReason: string | null
  eventSeq: number
  version: number
}

export interface SessionSnapshot {
  session: QueueSession
  entries: QueueEntry[]
  /** WAITING entry ids in the order the engine would call them now. */
  waitingOrder: string[]
  /** What Call Next would pick right now (nothing reserved). */
  suggestion: { entryId: string; reason: SelectionReason } | null
  now: string
}

export interface QueueDoctor {
  id: string
  fullName: string
  designation: string
  profilePictureUrl: string | null
  tokenPrefix: string
}

export interface QueueLane {
  doctor: QueueDoctor
  snapshot: SessionSnapshot | null
}

export interface QueuePolicy {
  smartQueueEnabled: boolean
  earlyWindowMin: number
  lateGraceMin: number
  maxLateMin: number
  walkinStarvationMin: number
  skippedRejoinPolicy: RejoinPolicy
  callTimeoutSec: number | null
  manualSelectReasonRequired: boolean
  serviceDayCutoff: string
  timezone: string
  source: 'default' | 'organization' | 'location'
}

export interface QueueBoardData {
  serviceDate: string
  now: string
  policy: QueuePolicy
  lanes: QueueLane[]
}

export interface ArrivalResult {
  entry: QueueEntry
  token: string
  sessionId: string
  doctorId: string
  serviceDate: string
  eventSeq: number
}

export interface EntryResult {
  entry: QueueEntry
  eventSeq: number
  encounterId?: string
}

export interface CallNextResult {
  entry: QueueEntry | null
  reason: SelectionReason | 'NO_ELIGIBLE_PATIENT'
  eventSeq: number
  suggestedEntryId?: string | null
}

export interface QueueTicket {
  clinicName: string | null
  locationName: string | null
  doctorName: string | null
  serviceDate: string
  token: string
  queueType: QueueType
  patientName: string | null
  scheduledStart: string | null
  checkedInAt: string
  peopleAhead: number | null
  status: EntryStatus
}

export interface DisplayDoctor {
  sessionId: string
  doctorId: string
  doctorName: string | null
  status: SessionStatus
  nowServing: { token: string; status: EntryStatus } | null
  next: string[]
  waitingCount: number
}

export interface DisplayState {
  locationId: string
  locationName: string
  /** The location's IANA timezone — the TV clock runs on it. */
  timezone: string
  serviceDate: string
  now: string
  doctors: DisplayDoctor[]
}

export interface QueuePolicySettings {
  organizationDefault: (QueuePolicy & { version: number }) | null
  locationOverride: (QueuePolicy & { version: number }) | null
  effective: QueuePolicy
}

export interface PatientVisit extends QueueEntry {
  serviceDate: string
  locationId: string
  doctorId: string
  doctorName: string | null
}

export interface CloseDecision {
  entryId: string
  action: 'cancel' | 'transfer'
  toDoctorId?: string
}
