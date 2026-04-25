import { z } from 'zod'

// ─── Enums (Matching Backend) ───────────────────────────────────────

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}

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

export const APPOINTMENT_STATUS_OPTIONS = [
  { label: 'Scheduled', value: AppointmentStatus.SCHEDULED },
  { label: 'Confirmed', value: AppointmentStatus.CONFIRMED },
  { label: 'In Progress', value: AppointmentStatus.IN_PROGRESS },
  { label: 'Completed', value: AppointmentStatus.COMPLETED },
  { label: 'Cancelled', value: AppointmentStatus.CANCELLED },
  { label: 'No Show', value: AppointmentStatus.NO_SHOW },
  { label: 'Rescheduled', value: AppointmentStatus.RESCHEDULED },
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
  [AppointmentStatus.IN_PROGRESS]: '#f59e0b',
  [AppointmentStatus.COMPLETED]: '#22c55e',
  [AppointmentStatus.CANCELLED]: '#ef4444',
  [AppointmentStatus.NO_SHOW]: '#6b7280',
  [AppointmentStatus.RESCHEDULED]: '#06b6d4',
}

export const STATUS_BG_COLORS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'bg-blue-50 border-blue-200 text-blue-700',
  [AppointmentStatus.CONFIRMED]: 'bg-violet-50 border-violet-200 text-violet-700',
  [AppointmentStatus.IN_PROGRESS]: 'bg-amber-50 border-amber-200 text-amber-700',
  [AppointmentStatus.COMPLETED]: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  [AppointmentStatus.CANCELLED]: 'bg-red-50 border-red-200 text-red-700',
  [AppointmentStatus.NO_SHOW]: 'bg-status-error/10 border-status-error/20 text-status-error',
  [AppointmentStatus.RESCHEDULED]: 'bg-cyan-50 border-cyan-200 text-cyan-700',
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

export interface Appointment {
  id: string
  organizationId: string
  locationId: string
  patientId: string
  doctorId: string | null
  type: AppointmentType
  status: AppointmentStatus
  startTime: string
  endTime: string
  durationMinutes: number
  isWalkIn: boolean
  isEmergency: boolean
  notes: string | null
  cancelReason: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
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
  scheduled: number
  inProgress: number
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
  notes: z.string().optional(),
  isWalkIn: z.boolean().default(false),
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
  type?: AppointmentType
  page?: number
  limit?: number
}

// ─── Calendar Helpers ───────────────────────────────────────────────

export const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7AM to 8PM
export const HOUR_HEIGHT = 80 // px per hour in calendar
export const MINUTE_HEIGHT = HOUR_HEIGHT / 60
