/** Mirrors the backend appointment DTO shapes (`backend/src/appointments`). Verified 2026-11-14. */

/** `backend/src/common/enums/appointment-status.enum.ts` */
export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** `backend/src/common/enums/appointment-type.enum.ts` */
export type AppointmentType =
  | 'consultation'
  | 'follow_up'
  | 'treatment'
  | 'checkup'
  | 'emergency'
  | 'cleaning';

/** List rows are bookings, or walk-ins dressed as bookings (`kind: 'walk_in'`). */
export type AppointmentKind = 'appointment' | 'walk_in';

/** The booking's latest queue entry; `token` is the doctor-wise token, e.g. "A-007". */
export interface AppointmentQueueEntry {
  id: string;
  token: string;
  /** Queue entry status (queue vocabulary, not AppointmentStatus). */
  status: string;
  sessionId: string;
}

export interface AppointmentPatient {
  id: string;
  fullName: string;
  phone: string;
  patientNumber: string | null;
}

export interface AppointmentDoctor {
  id: string;
  fullName: string;
}

export interface AppointmentListItem {
  /** A walk-in row carries its queue entry's id (it has no appointment row). */
  id: string;
  /** Only set when `includeWalkIns` is on; a missing value means 'appointment'. */
  kind?: AppointmentKind;
  organizationId: string;
  locationId: string;
  patientId: string;
  doctorId: string;
  type: AppointmentType | 'walk_in';
  status: AppointmentStatus;
  /** UTC instants. */
  startTime: string;
  endTime: string;
  durationMinutes: number;
  reasonForVisit: string | null;
  isEmergency: boolean;
  notes: string | null;
  checkedInAt: string | null;
  patient: AppointmentPatient;
  doctor: AppointmentDoctor;
  queueEntry: AppointmentQueueEntry | null;
}

/** `GET /appointments/:id` — the booking with its patient, doctor and location relations. */
export interface AppointmentDetail extends Omit<AppointmentListItem, 'kind' | 'type'> {
  type: AppointmentType;
  cancelReasonCode: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
  createdAt: string;
  updatedAt: string;
  location?: { id: string; name: string };
}

/** `GET /appointments` payload — note: no `totalPages`. */
export interface AppointmentPage {
  data: AppointmentListItem[];
  total: number;
  page: number;
  limit: number;
}

/** `GET /appointments/stats` */
export interface AppointmentStats {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  /** scheduled + confirmed */
  scheduled: number;
  checkedIn: number;
  walkIns: number;
  waiting: number;
  inProgress: number;
  /** null when no consultation has started in the range. */
  avgWaitMinutes: number | null;
  completionRate: number;
  noShowRate: number;
}

/** `GET /appointments/doctors` */
export interface DoctorOption {
  id: string;
  fullName: string;
  designation: string | null;
  profilePictureUrl: string | null;
}

/** What the schedule screen can filter by. Defaults: walk-ins included, nothing else. */
export interface AppointmentFilters {
  doctorId?: string;
  status?: AppointmentStatus;
  /** Patient name, phone or number (max 100 chars server-side). */
  search?: string;
  /** Default true (walk-ins merged into the day list). */
  includeWalkIns?: boolean;
}
