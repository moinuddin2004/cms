import { z } from 'zod'

// ─── Enums (Matching Backend) ───────────────────────────────────────

/**
 * Booking status only. After arrival the queue entry (features/queue) tracks
 * waiting / with the doctor / at a test; the appointment stays `checked_in`
 * until that entry completes or is cancelled.
 */
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  /** Arrived — has a token in the doctor's queue. */
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

/** Bookings that can still be edited, moved, confirmed, checked in or cancelled. */
export const NOT_ARRIVED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
]

export enum CancelReason {
  NO_SHOW = 'no_show',
  PATIENT_LEFT = 'patient_left',
  OTHER = 'other',
}

/** Cancel reasons. A no-show is a separate action (PATCH …/no-show). */
export const CANCEL_REASON_OPTIONS = [
  { label: 'Patient Left', value: CancelReason.PATIENT_LEFT },
  { label: 'Other', value: CancelReason.OTHER },
] as const

export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow_up',
  TREATMENT = 'treatment',
  CHECKUP = 'checkup',
  EMERGENCY = 'emergency',
  CLEANING = 'cleaning',
}

// ─── Options ───────────────────────────────────────────────────────

export const APPOINTMENT_TYPE_OPTIONS = [
  { label: 'Consultation', value: AppointmentType.CONSULTATION },
  { label: 'Follow Up', value: AppointmentType.FOLLOW_UP },
  { label: 'Treatment', value: AppointmentType.TREATMENT },
  { label: 'Checkup', value: AppointmentType.CHECKUP },
  { label: 'Emergency', value: AppointmentType.EMERGENCY },
  { label: 'Cleaning', value: AppointmentType.CLEANING },
] as const

/**
 * Not a booking type — a filter value that narrows the appointments list to
 * walk-ins (queue entries with no booking). Only the List view offers it.
 */
export const WALK_IN_TYPE_VALUE = 'walk_in' as const
export const WALK_IN_TYPE_OPTION = {
  label: 'Walk-in',
  value: WALK_IN_TYPE_VALUE,
} as const

export const APPOINTMENT_STATUS_OPTIONS = [
  { label: 'Scheduled', value: AppointmentStatus.SCHEDULED },
  { label: 'Confirmed', value: AppointmentStatus.CONFIRMED },
  { label: 'Checked In', value: AppointmentStatus.CHECKED_IN },
  { label: 'Completed', value: AppointmentStatus.COMPLETED },
  { label: 'Cancelled', value: AppointmentStatus.CANCELLED },
  { label: 'No Show', value: AppointmentStatus.NO_SHOW },
] as const

export const DURATION_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
] as const

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: '#3b82f6',
  [AppointmentStatus.CONFIRMED]: '#8b5cf6',
  [AppointmentStatus.CHECKED_IN]: '#eab308',
  [AppointmentStatus.COMPLETED]: '#22c55e',
  [AppointmentStatus.CANCELLED]: '#ef4444',
  [AppointmentStatus.NO_SHOW]: '#6b7280',
}

export const STATUS_BG_COLORS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]:
    'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-300',
  [AppointmentStatus.CONFIRMED]:
    'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/15 dark:border-violet-500/30 dark:text-violet-300',
  [AppointmentStatus.CHECKED_IN]:
    'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300',
  [AppointmentStatus.COMPLETED]:
    'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300',
  [AppointmentStatus.CANCELLED]:
    'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300',
  [AppointmentStatus.NO_SHOW]:
    'bg-status-error/10 border-status-error/20 text-status-error',
}

/** Human label per status — used in the queue and badges. */
export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.CONFIRMED]: 'Confirmed',
  [AppointmentStatus.CHECKED_IN]: 'Checked in',
  [AppointmentStatus.COMPLETED]: 'Completed',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.NO_SHOW]: 'No Show',
}

// ─── API Response Types ─────────────────────────────────────────────

export interface Doctor {
  id: string
  fullName: string
  designation: string
  profilePictureUrl: string | null
}

export interface AppointmentPatient {
  id: string
  fullName: string
  phone: string
  patientNumber?: string
  profilePictureUrl?: string | null
}

export interface AppointmentQueueEntry {
  id: string
  /** e.g. "A-007" */
  token: string
  status:
    | 'waiting'
    | 'called'
    | 'in_consultation'
    | 'on_hold'
    | 'skipped'
    | 'completed'
    | 'cancelled'
    | 'transferred'
    | 'aborted'
  sessionId: string
}

/** Short label for where an arrived patient is in the queue. */
export const QUEUE_STATUS_LABELS: Record<
  AppointmentQueueEntry['status'],
  string
> = {
  waiting: 'Waiting',
  called: 'Called',
  in_consultation: 'With doctor',
  on_hold: 'At a test',
  skipped: 'Skipped',
  completed: 'Seen',
  cancelled: 'Left',
  transferred: 'Transferred',
  aborted: 'Stopped',
}

export interface Appointment {
  id: string
  organizationId: string
  locationId: string
  patientId: string
  doctorId: string
  /** `walk_in` only on walk-in rows of the list (see `kind`). */
  type: AppointmentType | typeof WALK_IN_TYPE_VALUE
  /**
   * Set by the list when walk-ins are included. A walk-in row has no
   * booking: its `id` is the queue entry's, and it can't be opened, edited or
   * cancelled like an appointment.
   */
  kind?: 'appointment' | 'walk_in'
  status: AppointmentStatus
  startTime: string
  endTime: string
  durationMinutes: number
  reasonForVisit: string | null
  isEmergency: boolean
  notes: string | null
  cancelReasonCode: CancelReason | null
  cancelReason: string | null
  checkedInAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  noShowAt: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  /** Latest queue entry once the patient has arrived (doctor-wise token). */
  queueEntry?: AppointmentQueueEntry | null
  // Relations
  patient?: AppointmentPatient
  doctor?: Doctor | null
  location?: { id: string; name: string }
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  conflictLocation?: string
  suggestedStartTime?: string
}

export interface AppointmentStats {
  total: number
  completed: number
  cancelled: number
  noShow: number
  /** Scheduled + confirmed, not arrived yet. */
  scheduled: number
  checkedIn: number
  /** From the queue: walk-ins, waiting (incl. skipped / at test), with the doctor. */
  walkIns: number
  waiting: number
  inProgress: number
  avgWaitMinutes: number | null
  completionRate: number
  noShowRate: number
}

export interface PaginatedAppointments {
  data: Appointment[]
  total: number
  page: number
  limit: number
}

// ─── Zod Schemas ────────────────────────────────────────────────────

export const appointmentFormSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  startTime: z.string().min(1, 'Start time is required'),
  duration: z.coerce.number().min(5).max(480),
  type: z.nativeEnum(AppointmentType).default(AppointmentType.CONSULTATION),
  reasonForVisit: z.string().optional(),
  notes: z.string().optional(),
  isEmergency: z.boolean().default(false),
})

export type AppointmentFormData = z.infer<typeof appointmentFormSchema>

export const validateAppointmentSchema = z.object({
  doctorId: z.string().min(1),
  startTime: z.string().min(1),
  duration: z.coerce.number().min(5).max(480),
  excludeAppointmentId: z.string().optional(),
})

export type ValidateAppointmentData = z.infer<typeof validateAppointmentSchema>

// ─── Query / Filter Params ──────────────────────────────────────────

export interface AppointmentListParams {
  startDate?: string
  endDate?: string
  doctorId?: string
  patientId?: string
  status?: AppointmentStatus
  type?: AppointmentType | typeof WALK_IN_TYPE_VALUE
  /** Also return walk-ins, merged into the same sorted + paged list. */
  includeWalkIns?: boolean
  /** ILIKE across patient name, phone, and patient number. */
  search?: string
  page?: number
  limit?: number
}

// ─── Calendar Helpers ───────────────────────────────────────────────

export const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7AM to 8PM
export const HOUR_HEIGHT = 80 // px per hour in calendar
export const MINUTE_HEIGHT = HOUR_HEIGHT / 60
