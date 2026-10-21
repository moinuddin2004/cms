import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { percentOfTotal } from '../core/report-format';
import type {
  ReportDefinition,
  ReportParams,
  ReportRow,
  ReportScope,
} from '../core/report.types';
import { REPORTS_CLINICAL_FEATURE } from '../reports.constants';
import { label, localDay, minutesBetween, round1 } from './sql-helpers';

/** Appointment counts per group (day / doctor). */
const APPT_COUNTS = `
  COUNT(*)::int AS booked,
  COUNT(*) FILTER (WHERE a.status = 'completed')::int AS completed,
  COUNT(*) FILTER (WHERE a.status = 'checked_in')::int AS in_clinic,
  COUNT(*) FILTER (WHERE a.status IN ('scheduled', 'confirmed'))::int AS pending,
  COUNT(*) FILTER (WHERE a.status = 'cancelled')::int AS cancelled,
  COUNT(*) FILTER (WHERE a.status = 'no_show')::int AS no_show`;

const APPT_COLUMNS = [
  { key: 'booked', header: 'Booked', type: 'number', total: true },
  { key: 'completed', header: 'Completed', type: 'number', total: true },
  { key: 'inClinic', header: 'In clinic', type: 'number', total: true },
  { key: 'pending', header: 'Not yet', type: 'number', total: true },
  { key: 'cancelled', header: 'Cancelled', type: 'number', total: true },
  { key: 'noShow', header: 'No-show', type: 'number', total: true },
  { key: 'noShowPct', header: 'No-show %', type: 'percent' },
] as const;

function apptRow(r: Record<string, string | number | null>) {
  const n = (k: string) => Number(r[k] ?? 0);
  // No-show rate over appointments that were due to happen (not cancelled / not yet).
  const due = n('completed') + n('in_clinic') + n('no_show');
  return {
    booked: n('booked'),
    completed: n('completed'),
    inClinic: n('in_clinic'),
    pending: n('pending'),
    cancelled: n('cancelled'),
    noShow: n('no_show'),
    noShowPct: percentOfTotal(n('no_show'), due),
  };
}

/** Appointment WHERE: org, locations, start in range, optional doctor ($1..$4, $5 doctor). */
const APPT_WHERE = `a.organization_id = $1 AND a.location_id = ANY($2)
  AND a.start_time >= $3 AND a.start_time < $4
  AND ($5::uuid IS NULL OR a.doctor_id = $5::uuid)`;
const apptArgs = (s: ReportScope, p: ReportParams) => [
  s.organizationId,
  s.locationIds,
  p.start,
  p.end,
  p.doctorId ?? null,
];

/**
 * Queue entries of the period ($1 org, $2 locations, $3/$4 days, $5 doctor);
 * a transferred entry is replaced by its copy, so transfers count once.
 */
const queueFrom = (joins = '') => `queue_entries q
  JOIN queue_sessions qs ON qs.id = q.queue_session_id ${joins}
  WHERE qs.organization_id = $1 AND qs.location_id = ANY($2)
    AND qs.service_date BETWEEN $3 AND $4
    AND ($5::uuid IS NULL OR qs.doctor_id = $5::uuid)
    AND q.status <> 'transferred'`;
const QUEUE_FROM = queueFrom();
const queueArgs = (s: ReportScope, p: ReportParams) => [
  s.organizationId,
  s.locationIds,
  p.from,
  p.to,
  p.doctorId ?? null,
];

const WAIT = minutesBetween(
  'q.checked_in_at',
  'COALESCE(q.called_at, q.consultation_started_at)',
);
const CONSULT = minutesBetween('q.consultation_started_at', 'q.finished_at');
/** Queue timing per group: seen, left, wait and consultation minutes. */
const QUEUE_STATS = `
  COUNT(*)::int AS checked_in,
  COUNT(*) FILTER (WHERE q.status = 'completed')::int AS seen,
  COUNT(*) FILTER (WHERE q.status IN ('skipped', 'aborted', 'cancelled'))::int AS left_unseen,
  AVG(${WAIT}) FILTER (WHERE COALESCE(q.called_at, q.consultation_started_at) IS NOT NULL) AS avg_wait,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY ${WAIT})
    FILTER (WHERE COALESCE(q.called_at, q.consultation_started_at) IS NOT NULL) AS p90_wait,
  MAX(${WAIT}) AS max_wait,
  AVG(${CONSULT}) FILTER (WHERE q.status = 'completed' AND q.consultation_started_at IS NOT NULL) AS avg_consult`;

const QUEUE_COLUMNS = [
  { key: 'checkedIn', header: 'Checked in', type: 'number', total: true },
  { key: 'seen', header: 'Seen', type: 'number', total: true },
  { key: 'leftUnseen', header: 'Left unseen', type: 'number', total: true },
  { key: 'avgWait', header: 'Avg wait (min)', type: 'decimal' },
  { key: 'p90Wait', header: '90% waited under (min)', type: 'decimal' },
  { key: 'maxWait', header: 'Longest wait (min)', type: 'decimal' },
  { key: 'avgConsult', header: 'Avg consultation (min)', type: 'decimal' },
] as const;

function queueRow(r: Record<string, string | number | null>) {
  return {
    checkedIn: Number(r.checked_in ?? 0),
    seen: Number(r.seen ?? 0),
    leftUnseen: Number(r.left_unseen ?? 0),
    avgWait: round1(r.avg_wait),
    p90Wait: round1(r.p90_wait),
    maxWait: round1(r.max_wait),
    avgConsult: round1(r.avg_consult),
  };
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Appointments (booking) and the queue (arrival → doctor) — how patients flow. */
export function visitReports(db: DataSource): ReportDefinition[] {
  const feature = REPORTS_CLINICAL_FEATURE;
  return [
    {
      key: 'appointments-daily',
      title: 'Appointments by day',
      description:
        'Booked, completed, cancelled and no-show appointments for each day.',
      category: 'appointments',
      feature,
      filters: { dates: 'range', doctor: true },
      columns: [{ key: 'date', header: 'Date', type: 'date' }, ...APPT_COLUMNS],
      async run(s, p) {
        const rows = await sqlRows<Record<string, string>>(
          db,
          `SELECT ${localDay('a.start_time', '$6')}::text AS date, ${APPT_COUNTS}
             FROM appointments a WHERE ${APPT_WHERE}
            GROUP BY 1 ORDER BY 1 DESC`,
          [...apptArgs(s, p), s.tz],
        );
        return {
          rows: rows.map((r) => ({ date: r.date, ...apptRow(r) })),
          notes: [
            'No-show % = no-shows ÷ appointments that were due (completed, in clinic or no-show).',
          ],
        };
      },
    },
    {
      key: 'appointments-by-doctor',
      title: 'Appointments by doctor',
      description: 'Each doctor’s bookings, completions and no-show rate.',
      category: 'appointments',
      feature,
      filters: { dates: 'range' },
      columns: [
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 2 },
        ...APPT_COLUMNS,
      ],
      async run(s, p) {
        const rows = await sqlRows<Record<string, string>>(
          db,
          `SELECT COALESCE(e.full_name, 'No doctor') AS doctor, ${APPT_COUNTS}
             FROM appointments a LEFT JOIN employees e ON e.id = a.doctor_id
            WHERE ${APPT_WHERE}
            GROUP BY e.id, e.full_name ORDER BY booked DESC`,
          [...apptArgs(s, { ...p, doctorId: undefined })],
        );
        return { rows: rows.map((r) => ({ doctor: r.doctor, ...apptRow(r) })) };
      },
    },
    {
      key: 'no-shows',
      title: 'No-shows & cancellations',
      description: 'Who missed or cancelled, why, and how often they do it.',
      category: 'appointments',
      feature,
      filters: { dates: 'range', doctor: true },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        { key: 'time', header: 'Time', type: 'text', weight: 0.7 },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2 },
        { key: 'phone', header: 'Phone', type: 'text', weight: 1.3 },
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 1.5 },
        { key: 'status', header: 'What happened', type: 'text', weight: 1.1 },
        { key: 'reason', header: 'Reason', type: 'text', weight: 2.2 },
        { key: 'timesMissed', header: 'Missed (all time)', type: 'number' },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT ${localDay('a.start_time', '$6')}::text AS date,
                  to_char(a.start_time AT TIME ZONE $6, 'HH24:MI') AS time,
                  pt.full_name AS patient, pt.phone, e.full_name AS doctor,
                  CASE WHEN a.status = 'no_show' THEN 'No-show' ELSE 'Cancelled' END AS status,
                  COALESCE(a.cancel_reason, ${label('a.cancel_reason_code')}) AS reason,
                  (SELECT COUNT(*) FROM appointments a2
                    WHERE a2.patient_id = a.patient_id AND a2.organization_id = $1
                      AND a2.status = 'no_show')::int AS "timesMissed"
             FROM appointments a
             JOIN patients pt ON pt.id = a.patient_id
             LEFT JOIN employees e ON e.id = a.doctor_id
            WHERE ${APPT_WHERE} AND a.status IN ('no_show', 'cancelled')
            ORDER BY a.start_time DESC
            LIMIT $7`,
          [...apptArgs(s, p), s.tz, p.limit],
        );
        const noShows = rows.filter((r) => r.status === 'No-show').length;
        return {
          rows,
          summary: [
            { label: 'No-shows', value: noShows, type: 'number' },
            {
              label: 'Cancellations',
              value: rows.length - noShows,
              type: 'number',
            },
          ],
        };
      },
    },
    {
      key: 'visit-mix',
      title: 'Walk-ins vs appointments',
      description:
        'How many patients arrive with and without an appointment, per day.',
      category: 'appointments',
      feature,
      filters: { dates: 'range', doctor: true },
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        {
          key: 'appointment',
          header: 'With appointment',
          type: 'number',
          total: true,
        },
        { key: 'walkIn', header: 'Walk-in', type: 'number', total: true },
        { key: 'total', header: 'Total arrivals', type: 'number', total: true },
        { key: 'walkInPct', header: 'Walk-in %', type: 'percent' },
      ],
      async run(s, p) {
        const rows = await sqlRows<{
          date: string;
          appointment: string;
          walk_in: string;
        }>(
          db,
          `SELECT qs.service_date::text AS date,
                  COUNT(*) FILTER (WHERE q.queue_type = 'appointment') AS appointment,
                  COUNT(*) FILTER (WHERE q.queue_type = 'walk_in') AS walk_in
             FROM ${QUEUE_FROM}
            GROUP BY 1 ORDER BY 1 DESC`,
          queueArgs(s, p),
        );
        const mapped = rows.map((r) => {
          const appointment = Number(r.appointment);
          const walkIn = Number(r.walk_in);
          return {
            date: r.date,
            appointment,
            walkIn,
            total: appointment + walkIn,
            walkInPct: percentOfTotal(walkIn, appointment + walkIn),
          };
        });
        const walk = mapped.reduce((a, r) => a + r.walkIn, 0);
        const all = mapped.reduce((a, r) => a + r.total, 0);
        return {
          rows: mapped,
          summary: [
            { label: 'Arrivals', value: all, type: 'number' },
            {
              label: 'Walk-in share',
              value: percentOfTotal(walk, all),
              type: 'percent',
            },
          ],
        };
      },
    },
    {
      key: 'busy-hours',
      title: 'Rush hours',
      description:
        'Arrivals by hour and weekday — plan staff and chairs around the peaks.',
      category: 'appointments',
      feature,
      filters: { dates: 'range', doctor: true },
      landscape: true,
      columns: [
        { key: 'hour', header: 'Hour', type: 'text', weight: 1.3 },
        { key: 'mon', header: 'Mon', type: 'number', total: true },
        { key: 'tue', header: 'Tue', type: 'number', total: true },
        { key: 'wed', header: 'Wed', type: 'number', total: true },
        { key: 'thu', header: 'Thu', type: 'number', total: true },
        { key: 'fri', header: 'Fri', type: 'number', total: true },
        { key: 'sat', header: 'Sat', type: 'number', total: true },
        { key: 'sun', header: 'Sun', type: 'number', total: true },
        { key: 'total', header: 'Total', type: 'number', total: true },
      ],
      async run(s, p) {
        const rows = await sqlRows<{ dow: number; hour: number; n: string }>(
          db,
          `SELECT EXTRACT(ISODOW FROM q.checked_in_at AT TIME ZONE $6)::int AS dow,
                  EXTRACT(HOUR FROM q.checked_in_at AT TIME ZONE $6)::int AS hour,
                  COUNT(*) AS n
             FROM ${QUEUE_FROM} AND q.checked_in_at IS NOT NULL
            GROUP BY 1, 2`,
          [...queueArgs(s, p), s.tz],
        );
        return {
          rows: hourMatrix(rows),
          notes: ['Counted by check-in time at the clinic.'],
        };
      },
    },
    {
      key: 'queue-by-doctor',
      title: 'Waiting time by doctor',
      description:
        'How long patients wait for each doctor and how long consultations take.',
      category: 'operations',
      feature,
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 2 },
        ...QUEUE_COLUMNS,
      ],
      async run(s, p) {
        const rows = await sqlRows<Record<string, string>>(
          db,
          `SELECT COALESCE(e.full_name, 'No doctor') AS doctor, ${QUEUE_STATS}
             FROM ${queueFrom('LEFT JOIN employees e ON e.id = qs.doctor_id')}
            GROUP BY e.id, e.full_name ORDER BY checked_in DESC`,
          queueArgs(s, { ...p, doctorId: undefined }),
        );
        return {
          rows: rows.map((r) => ({ doctor: r.doctor, ...queueRow(r) })),
          notes: [
            'Wait = check-in → called by the doctor. Consultation = start → finish.',
          ],
        };
      },
    },
    {
      key: 'queue-daily',
      title: 'Waiting time by day',
      description:
        'Arrivals, patients seen and waiting time for each clinic day.',
      category: 'operations',
      feature,
      filters: { dates: 'range', doctor: true },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        ...QUEUE_COLUMNS,
      ],
      async run(s, p) {
        const rows = await sqlRows<Record<string, string>>(
          db,
          `SELECT qs.service_date::text AS date, ${QUEUE_STATS}
             FROM ${QUEUE_FROM}
            GROUP BY 1 ORDER BY 1 DESC`,
          queueArgs(s, p),
        );
        return { rows: rows.map((r) => ({ date: r.date, ...queueRow(r) })) };
      },
    },
    {
      key: 'left-unseen',
      title: 'Left without being seen',
      description:
        'Patients who checked in but were skipped, cancelled or left.',
      category: 'operations',
      feature,
      filters: { dates: 'range', doctor: true },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        { key: 'token', header: 'Token', type: 'text', weight: 0.8 },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2 },
        { key: 'phone', header: 'Phone', type: 'text', weight: 1.3 },
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 1.5 },
        { key: 'type', header: 'Came as', type: 'text', weight: 1 },
        { key: 'status', header: 'What happened', type: 'text', weight: 1 },
        { key: 'waited', header: 'Waited (min)', type: 'decimal' },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT qs.service_date::text AS date,
                  COALESCE(qs.token_prefix, '') || q.token_number AS token,
                  pt.full_name AS patient, pt.phone, e.full_name AS doctor,
                  ${label('q.queue_type')} AS type, ${label('q.status')} AS status,
                  ROUND((${minutesBetween('q.checked_in_at', 'COALESCE(q.skipped_at, q.finished_at, q.checked_in_at)')})::numeric, 1) AS waited
             FROM ${queueFrom('JOIN patients pt ON pt.id = q.patient_id LEFT JOIN employees e ON e.id = qs.doctor_id')}
              AND q.status IN ('skipped', 'aborted', 'cancelled')
            ORDER BY qs.service_date DESC, q.checked_in_at DESC
            LIMIT $6`,
          [...queueArgs(s, p), p.limit],
        );
        return { rows: rows.map((r) => ({ ...r, waited: round1(r.waited) })) };
      },
    },
  ];
}

/** Arrival counts → one row per active hour with a column per weekday. */
export function hourMatrix(
  cells: Array<{ dow: number; hour: number; n: string | number }>,
): ReportRow[] {
  const byHour = new Map<number, ReportRow>();
  for (const c of cells) {
    const row =
      byHour.get(c.hour) ??
      ({
        hour: `${String(c.hour).padStart(2, '0')}:00–${String((c.hour + 1) % 24).padStart(2, '0')}:00`,
        ...Object.fromEntries(WEEKDAYS.map((d) => [d, 0])),
        total: 0,
      } as ReportRow);
    const day = WEEKDAYS[c.dow - 1];
    row[day] = Number(row[day]) + Number(c.n);
    row.total = Number(row.total) + Number(c.n);
    byHour.set(c.hour, row);
  }
  return [...byHour.entries()].sort(([a], [b]) => a - b).map(([, r]) => r);
}
