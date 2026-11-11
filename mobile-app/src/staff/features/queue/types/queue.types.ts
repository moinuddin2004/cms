/**
 * Queue payload types. Mirror the backend views in
 * `backend/src/queue/services/queue-query.service.ts` and the DTOs in
 * `backend/src/queue/dto/queue.dto.ts` (docs/07 §2.3). Backend enums are
 * string-literal unions here, never TS enums.
 */

export type QueueType = 'appointment' | 'walk_in';

export type EntryStatus =
  | 'waiting'
  | 'called'
  | 'in_consultation'
  | 'on_hold'
  | 'skipped'
  | 'completed'
  | 'cancelled'
  | 'transferred'
  | 'aborted';

export type SessionStatus = 'waiting_for_doctor' | 'open' | 'paused' | 'closed';

export type PriorityClass = 'normal' | 'authorized_urgent';

export type SelectionReason =
  | 'URGENT'
  | 'STARVATION_GUARD'
  | 'APPOINTMENT_DUE'
  | 'RETURNED_FROM_TEST'
  | 'FIFO'
  | 'MANUAL_SELECT';

export type RejoinPolicy = 'end' | 'original_position' | 'manual';

// ─── Views (responses) ───────────────────────────────────────────

export interface EntryPatient {
  id: string;
  fullName: string;
  phone: string | null;
  patientNumber: string | null;
}

export interface EntryView {
  id: string;
  sessionId: string;
  /** Display token, e.g. "A-007". */
  token: string;
  tokenNumber: number;
  queueType: QueueType;
  status: EntryStatus;
  priorityClass: PriorityClass;
  urgentReason: string | null;
  urgentSince: string | null;
  patient: EntryPatient | null;
  appointmentId: string | null;
  scheduledStart: string | null;
  reasonForVisit: string | null;
  checkedInAt: string;
  sortAnchorAt: string;
  calledAt: string | null;
  consultationStartedAt: string | null;
  holdStartedAt: string | null;
  returnedFromHoldAt: string | null;
  skippedAt: string | null;
  finishedAt: string | null;
  convertedFromApptId: string | null;
  transferredFromId: string | null;
  /** Sent back as `If-Match` on entry actions. */
  version: number;
}

export interface SessionView {
  id: string;
  organizationId: string;
  locationId: string;
  doctorId: string;
  doctorName: string | null;
  /** YYYY-MM-DD, the location's service day. */
  serviceDate: string;
  status: SessionStatus;
  tokenPrefix: string;
  smartQueueEnabled: boolean;
  pauseReason: string | null;
  startedAt: string | null;
  closedAt: string | null;
  lastCallReason: SelectionReason | null;
  eventSeq: number;
  version: number;
}

export interface SessionSnapshot {
  session: SessionView;
  entries: EntryView[];
  /** Waiting entry ids in the order Call next would take them. */
  waitingOrder: string[];
  suggestion: { entryId: string; reason: SelectionReason } | null;
  now: string;
}

export interface QueuePolicy {
  smartQueueEnabled: boolean;
  earlyWindowMin: number;
  lateGraceMin: number;
  maxLateMin: number;
  walkinStarvationMin: number;
  skippedRejoinPolicy: RejoinPolicy;
  callTimeoutSec: number | null;
  manualSelectReasonRequired: boolean;
  serviceDayCutoff: string;
  /** The location's IANA timezone. */
  timezone: string;
  source: 'default' | 'organization' | 'location';
}

export interface LaneDoctor {
  id: string;
  fullName: string;
  designation: string;
  profilePictureUrl: string | null;
  tokenPrefix: string;
}

export interface QueueLane {
  doctor: LaneDoctor;
  /** null = the doctor has no session for that day yet. */
  snapshot: SessionSnapshot | null;
}

/** `GET /queue/sessions` — reception board. */
export interface BoardResponse {
  serviceDate: string;
  now: string;
  policy: QueuePolicy;
  lanes: QueueLane[];
}

export interface SessionResult {
  session: SessionView;
}

export interface EntryResult {
  entry: EntryView;
  eventSeq: number;
  /** Only `start-consultation` returns it. */
  encounterId?: string;
}

/** Walk-in, check-in and convert-to-walk-in all answer with this. */
export interface ArrivalResult {
  entry: EntryView;
  token: string;
  sessionId: string;
  doctorId: string;
  serviceDate: string;
  eventSeq: number;
}

export interface CallNextResult {
  /** null when `reason === 'NO_ELIGIBLE_PATIENT'`. */
  entry: EntryView | null;
  reason: SelectionReason | 'NO_ELIGIBLE_PATIENT';
  eventSeq: number;
}

/** `PATCH entries/:id/select` — the manual pick plus what the smart order would have chosen. */
export interface SelectResult {
  entry: EntryView;
  reason: 'MANUAL_SELECT';
  suggestedEntryId: string | null;
  eventSeq: number;
}

export interface TransferResult {
  /** The entry in the source session (now `transferred`). */
  from: EntryView;
  /** The new entry in the target doctor's queue. */
  entry: EntryView;
  token: string;
  sessionId: string;
}

export interface NextPreview {
  suggestion: { entryId: string; reason: SelectionReason } | null;
  waitingOrder: string[];
  eventSeq: number;
}

export interface TicketView {
  clinicName: string | null;
  locationName: string | null;
  doctorName: string | null;
  serviceDate: string;
  token: string;
  queueType: QueueType;
  patientName: string | null;
  scheduledStart: string | null;
  checkedInAt: string;
  /** Approximate; null when the entry is not waiting. */
  peopleAhead: number | null;
  status: EntryStatus;
}

/** `GET /queue/patients/:patientId/visits` row. */
export interface PatientVisit extends EntryView {
  serviceDate: string;
  locationId: string;
  doctorId: string;
  doctorName: string | null;
}

// ─── Requests ────────────────────────────────────────────────────

/** Sent only for the documented fields — the backend rejects unknown ones. */
export interface WalkInInput {
  doctorId: string;
  /** Existing patient. Otherwise send `patientName` + `patientPhone`. */
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  reasonForVisit?: string;
  urgentReason?: string;
  /** Proceed although the patient is active with another doctor today. */
  force?: boolean;
}

export interface UrgentInput {
  urgentReason?: string;
}

export interface CloseDecision {
  entryId: string;
  action: 'cancel' | 'transfer';
  /** Required when `action === 'transfer'`. */
  toDoctorId?: string;
}

export interface CloseSessionInput {
  decisions: CloseDecision[];
}

/** Headers every queue mutation carries (docs/07 §2.3). */
export interface IdemOptions {
  /** One per user intent — from `useIdempotentMutation`. */
  idempotencyKey: string;
}

/** Entry actions that honour `If-Match` (the server checks `entry.version`). */
export interface MutationOptions extends IdemOptions {
  /** The `entry.version` the screen is looking at. */
  ifMatch?: number;
}
