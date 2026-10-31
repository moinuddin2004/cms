import {
  AppointmentStatus,
  STATUS_BG_COLORS,
  STATUS_LABELS,
} from '@/features/appointments'
import type { Appointment } from '@/features/appointments'
import { ENTRY_STATUS_LABELS } from '@/features/queue'
import type { PatientVisit } from '@/features/queue'
import type { Encounter } from '../../../types'
import { CHIP_TONES, timeOf } from './HistoryParts'

/** One line of the patient's appointment history: a booking or a walk-in. */
export interface ApptRow {
  id: string
  kind: 'appointment' | 'walk_in'
  at: Date
  upcoming: boolean
  typeLabel: string
  timeLabel: string
  statusLabel: string
  statusClass: string
  doctor: string | null
  token: string | null
  reason: string | null
  emergency: boolean
  /** Queue entry id, to find the visit (encounter) it led to. */
  queueEntryId: string | null
  appt?: Appointment
  visit?: PatientVisit
}

const TERMINAL = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
]

const WALK_IN_TONE: Partial<Record<PatientVisit['status'], string>> = {
  completed: CHIP_TONES.success,
  cancelled: CHIP_TONES.danger,
  aborted: CHIP_TONES.danger,
  in_consultation: CHIP_TONES.info,
  waiting: CHIP_TONES.warning,
}

export function buildApptRows(
  appointments: Appointment[],
  visits: PatientVisit[],
  now = Date.now(),
): ApptRow[] {
  const rows: ApptRow[] = appointments.map((a) => {
    const start = new Date(a.startTime)
    return {
      id: a.id,
      kind: 'appointment',
      at: start,
      upcoming: start.getTime() >= now && !TERMINAL.includes(a.status),
      typeLabel: a.type.replace(/_/g, ' '),
      timeLabel: `${timeOf(start)} – ${timeOf(new Date(a.endTime))}`,
      statusLabel: STATUS_LABELS[a.status],
      statusClass: STATUS_BG_COLORS[a.status],
      doctor: a.doctor?.fullName ?? null,
      token: a.queueEntry?.token ?? null,
      reason: a.reasonForVisit,
      emergency: a.isEmergency,
      queueEntryId: a.queueEntry?.id ?? null,
      appt: a,
    }
  })
  // Walk-ins have no appointment row — they come from the queue visits.
  for (const v of visits) {
    if (v.queueType !== 'walk_in') continue
    const at = new Date(v.checkedInAt)
    rows.push({
      id: v.id,
      kind: 'walk_in',
      at,
      upcoming: false,
      typeLabel: 'Walk-in visit',
      timeLabel: `Arrived ${timeOf(at)}`,
      statusLabel: ENTRY_STATUS_LABELS[v.status],
      statusClass: WALK_IN_TONE[v.status] ?? CHIP_TONES.muted,
      doctor: v.doctorName,
      token: v.token,
      reason: v.reasonForVisit,
      emergency: v.priorityClass === 'authorized_urgent',
      queueEntryId: v.id,
      visit: v,
    })
  }
  // Upcoming soonest-first on top, then history newest-first.
  return rows.sort((x, y) =>
    x.upcoming !== y.upcoming
      ? x.upcoming
        ? -1
        : 1
      : x.upcoming
        ? x.at.getTime() - y.at.getTime()
        : y.at.getTime() - x.at.getTime(),
  )
}

/** The visit a booking / walk-in led to, if the doctor has seen them. */
export function findEncounter(
  row: ApptRow,
  encounters: Encounter[],
): Encounter | undefined {
  return encounters.find(
    (e) =>
      (row.appt && e.appointmentId === row.appt.id) ||
      (row.queueEntryId && e.queueEntryId === row.queueEntryId),
  )
}
