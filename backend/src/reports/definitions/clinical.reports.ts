import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { percentOfTotal } from '../core/report-format';
import type { ReportDefinition, ReportRow } from '../core/report.types';
import { REPORTS_CLINICAL_FEATURE } from '../reports.constants';
import {
  ENCOUNTER_DOCTOR,
  ENCOUNTER_DOCTOR_JOINS,
  label,
  localDay,
  minutesBetween,
  round1,
  utc,
} from './sql-helpers';

/** Lab order states that are finished (lab-orders service `CLOSED`). */
const LAB_CLOSED = `('draft', 'cancelled', 'completed', 'rejected_by_lab')`;

/** Free-text answers grouped case- and space-insensitively. */
const normalized = (col: string) =>
  `lower(regexp_replace(trim(${col}), '\\s+', ' ', 'g'))`;

/** "Top values of a free-text encounter field" (diagnosis / chief complaint). */
function textFrequency(
  db: DataSource,
  key: string,
  title: string,
  description: string,
  column: 'diagnosis' | 'chief_complaint',
  header: string,
): ReportDefinition {
  return {
    key,
    title,
    description,
    category: 'clinical',
    feature: REPORTS_CLINICAL_FEATURE,
    filters: { dates: 'range' },
    columns: [
      { key: 'text', header, type: 'text', weight: 3 },
      { key: 'visits', header: 'Visits', type: 'number', total: true },
      { key: 'patients', header: 'Patients', type: 'number' },
      { key: 'share', header: 'Share of visits', type: 'percent' },
    ],
    async run(s, p) {
      const rows = await sqlRows<{
        text: string;
        visits: string;
        patients: string;
      }>(
        db,
        `SELECT MIN(trim(e.${column})) AS text, COUNT(*) AS visits, COUNT(DISTINCT e.patient_id) AS patients
           FROM patient_encounters e
          WHERE e.organization_id = $1 AND e.location_id = ANY($2)
            AND e.encounter_date >= $3 AND e.encounter_date < $4
            AND NULLIF(trim(e.${column}), '') IS NOT NULL
          GROUP BY ${normalized(`e.${column}`)}
          ORDER BY 2 DESC, 1
          LIMIT $5`,
        [s.organizationId, s.locationIds, p.start, p.end, p.limit],
      );
      const total = rows.reduce((a, r) => a + Number(r.visits), 0);
      return {
        rows: rows.map((r) => ({
          text: r.text,
          visits: Number(r.visits),
          patients: Number(r.patients),
          share: percentOfTotal(Number(r.visits), total),
        })),
        notes: [
          'Typed by doctors, so the same thing spelled differently shows as separate lines.',
        ],
      };
    },
  };
}

/** What doctors do: visits, treatments, prescriptions, plans and lab work. */
export function clinicalReports(db: DataSource): ReportDefinition[] {
  const feature = REPORTS_CLINICAL_FEATURE;
  return [
    {
      key: 'doctor-activity',
      title: 'Doctor activity',
      description:
        'Patients seen, treatments, prescriptions, plans and lab orders per doctor.',
      category: 'clinical',
      feature,
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 2 },
        { key: 'visits', header: 'Visits', type: 'number', total: true },
        { key: 'patients', header: 'Patients', type: 'number' },
        {
          key: 'firstVisits',
          header: 'First visits',
          type: 'number',
          total: true,
        },
        {
          key: 'treatments',
          header: 'Treatments',
          type: 'number',
          total: true,
        },
        {
          key: 'prescriptions',
          header: 'Prescriptions',
          type: 'number',
          total: true,
        },
        { key: 'plans', header: 'Plans made', type: 'number', total: true },
        { key: 'labOrders', header: 'Lab orders', type: 'number', total: true },
        { key: 'avgConsult', header: 'Avg consult (min)', type: 'decimal' },
      ],
      async run(s, p) {
        // $1 org, $2 locations, $3/$4 days, $5/$6 instants
        const rows = await sqlRows<Record<string, string | null>>(
          db,
          `WITH enc AS (
             SELECT ${ENCOUNTER_DOCTOR} AS doctor_id, e.id, e.patient_id,
                    NOT EXISTS (SELECT 1 FROM patient_encounters e2
                                 WHERE e2.patient_id = e.patient_id AND e2.location_id = ANY($2)
                                   AND e2.encounter_date < e.encounter_date) AS first_visit,
                    CASE WHEN qe.status = 'completed' AND qe.consultation_started_at IS NOT NULL
                         THEN ${minutesBetween('qe.consultation_started_at', 'qe.finished_at')} END AS consult
               FROM patient_encounters e ${ENCOUNTER_DOCTOR_JOINS}
              WHERE e.organization_id = $1 AND e.location_id = ANY($2)
                AND e.encounter_date >= $5 AND e.encounter_date < $6),
           v AS (SELECT doctor_id, COUNT(*) AS visits, COUNT(DISTINCT patient_id) AS patients,
                        COUNT(*) FILTER (WHERE first_visit) AS first_visits, AVG(consult) AS avg_consult
                   FROM enc GROUP BY 1),
           t AS (SELECT enc.doctor_id, COUNT(*) AS n FROM treatments tr JOIN enc ON enc.id = tr.encounter_id
                  GROUP BY 1),
           rx AS (SELECT doctor_id, COUNT(*) AS n FROM prescriptions
                   WHERE organization_id = $1 AND location_id = ANY($2) AND status <> 'DRAFT'
                     AND ${utc('created_at')} >= $5 AND ${utc('created_at')} < $6
                   GROUP BY 1),
           pl AS (SELECT dentist_id AS doctor_id, COUNT(*) AS n FROM patient_treatment_plans
                   WHERE organization_id = $1 AND location_id = ANY($2) AND deleted_at IS NULL
                     AND ${utc('created_at')} >= $5 AND ${utc('created_at')} < $6
                   GROUP BY 1),
           lo AS (SELECT doctor_id, COUNT(*) AS n FROM lab_orders
                   WHERE organization_id = $1 AND location_id = ANY($2) AND status_code <> 'draft'
                     AND requested_on BETWEEN $3 AND $4
                   GROUP BY 1),
           docs AS (SELECT doctor_id FROM v UNION SELECT doctor_id FROM rx UNION SELECT doctor_id FROM pl
                    UNION SELECT doctor_id FROM lo)
           SELECT COALESCE(emp.full_name, 'No doctor') AS doctor,
                  COALESCE(v.visits, 0) AS visits, COALESCE(v.patients, 0) AS patients,
                  COALESCE(v.first_visits, 0) AS first_visits, COALESCE(t.n, 0) AS treatments,
                  COALESCE(rx.n, 0) AS prescriptions, COALESCE(pl.n, 0) AS plans,
                  COALESCE(lo.n, 0) AS lab_orders, v.avg_consult
             FROM docs
             LEFT JOIN v ON v.doctor_id IS NOT DISTINCT FROM docs.doctor_id
             LEFT JOIN t ON t.doctor_id IS NOT DISTINCT FROM docs.doctor_id
             LEFT JOIN rx ON rx.doctor_id IS NOT DISTINCT FROM docs.doctor_id
             LEFT JOIN pl ON pl.doctor_id IS NOT DISTINCT FROM docs.doctor_id
             LEFT JOIN lo ON lo.doctor_id IS NOT DISTINCT FROM docs.doctor_id
             LEFT JOIN employees emp ON emp.id = docs.doctor_id
            ORDER BY COALESCE(v.visits, 0) DESC`,
          [s.organizationId, s.locationIds, p.from, p.to, p.start, p.end],
        );
        return {
          rows: rows.map((r) => ({
            doctor: r.doctor,
            visits: Number(r.visits),
            patients: Number(r.patients),
            firstVisits: Number(r.first_visits),
            treatments: Number(r.treatments),
            prescriptions: Number(r.prescriptions),
            plans: Number(r.plans),
            labOrders: Number(r.lab_orders),
            avgConsult: round1(r.avg_consult),
          })),
          notes: [
            'A visit belongs to the doctor of its queue token (or appointment).',
          ],
        };
      },
    },
    {
      key: 'treatment-plans',
      title: 'Treatment plan conversion',
      description:
        'Plans proposed per doctor, how many patients accepted and finished them.',
      category: 'clinical',
      feature,
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 2 },
        { key: 'plans', header: 'Plans', type: 'number', total: true },
        { key: 'value', header: 'Plan value', type: 'money', total: true },
        { key: 'accepted', header: 'Accepted', type: 'number', total: true },
        {
          key: 'acceptedValue',
          header: 'Accepted value',
          type: 'money',
          total: true,
        },
        { key: 'acceptPct', header: 'Acceptance %', type: 'percent' },
        { key: 'active', header: 'In progress', type: 'number', total: true },
        { key: 'completed', header: 'Completed', type: 'number', total: true },
        { key: 'cancelled', header: 'Cancelled', type: 'number', total: true },
      ],
      async run(s, p) {
        const rows = await sqlRows<Record<string, string | null>>(
          db,
          `SELECT COALESCE(e.full_name, 'No doctor') AS doctor, COUNT(*) AS plans,
                  (SUM(COALESCE(tp.final_estimated_cost, tp.estimated_cost, 0)) * 100)::bigint AS value,
                  COUNT(*) FILTER (WHERE tp.patient_accepted) AS accepted,
                  (COALESCE(SUM(COALESCE(tp.final_estimated_cost, tp.estimated_cost, 0))
                     FILTER (WHERE tp.patient_accepted), 0) * 100)::bigint AS accepted_value,
                  COUNT(*) FILTER (WHERE tp.status IN ('active', 'on_hold')) AS active,
                  COUNT(*) FILTER (WHERE tp.status = 'completed') AS completed,
                  COUNT(*) FILTER (WHERE tp.status = 'cancelled') AS cancelled
             FROM patient_treatment_plans tp
             LEFT JOIN employees e ON e.id = tp.dentist_id
            WHERE tp.organization_id = $1 AND tp.location_id = ANY($2) AND tp.deleted_at IS NULL
              AND ${utc('tp.created_at')} >= $3 AND ${utc('tp.created_at')} < $4
            GROUP BY e.id, e.full_name ORDER BY plans DESC`,
          [s.organizationId, s.locationIds, p.start, p.end],
        );
        return {
          rows: rows.map((r) => {
            const plans = Number(r.plans);
            const accepted = Number(r.accepted);
            return {
              doctor: r.doctor,
              plans,
              value: Number(r.value),
              accepted,
              acceptedValue: Number(r.accepted_value),
              acceptPct: percentOfTotal(accepted, plans),
              active: Number(r.active),
              completed: Number(r.completed),
              cancelled: Number(r.cancelled),
            };
          }),
          notes: ['Plans counted by the day they were made.'],
        };
      },
    },
    textFrequency(
      db,
      'diagnoses',
      'Top diagnoses',
      'The most common diagnoses doctors recorded in the period.',
      'diagnosis',
      'Diagnosis',
    ),
    textFrequency(
      db,
      'complaints',
      'Top complaints',
      'Why patients came in — the chief complaints recorded at the visit.',
      'chief_complaint',
      'Chief complaint',
    ),
    {
      key: 'treatments-done',
      title: 'Treatments done',
      description:
        'How often each treatment was performed and for how many patients.',
      category: 'clinical',
      feature,
      filters: { dates: 'range' },
      columns: [
        { key: 'treatment', header: 'Treatment', type: 'text', weight: 3 },
        { key: 'times', header: 'Times done', type: 'number', total: true },
        { key: 'patients', header: 'Patients', type: 'number' },
        { key: 'share', header: 'Share', type: 'percent' },
      ],
      async run(s, p) {
        const rows = await sqlRows<{
          treatment: string;
          times: string;
          patients: string;
        }>(
          db,
          `SELECT MIN(trim(t.treatment_name)) AS treatment, COUNT(*) AS times,
                  COUNT(DISTINCT t.patient_id) AS patients
             FROM treatments t
            WHERE t.organization_id = $1 AND t.location_id = ANY($2)
              AND t.date >= $3 AND t.date < $4
            GROUP BY ${normalized('t.treatment_name')}
            ORDER BY 2 DESC LIMIT $5`,
          [s.organizationId, s.locationIds, p.start, p.end, p.limit],
        );
        const total = rows.reduce((a, r) => a + Number(r.times), 0);
        return {
          rows: rows.map((r) => ({
            treatment: r.treatment,
            times: Number(r.times),
            patients: Number(r.patients),
            share: percentOfTotal(Number(r.times), total),
          })),
        };
      },
    },
    {
      key: 'medicines',
      title: 'Most prescribed medicines',
      description:
        'Medicines on finalized prescriptions — useful for pharmacy stock.',
      category: 'clinical',
      feature,
      filters: { dates: 'range', doctor: true },
      columns: [
        { key: 'medicine', header: 'Medicine', type: 'text', weight: 3 },
        { key: 'type', header: 'Form', type: 'text', weight: 1 },
        {
          key: 'times',
          header: 'Times prescribed',
          type: 'number',
          total: true,
        },
        { key: 'patients', header: 'Patients', type: 'number' },
        { key: 'doctors', header: 'Doctors', type: 'number' },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT MIN(trim(pm.medicine_name)) AS medicine, MIN(${label('pm.type')}) AS type,
                  COUNT(*)::int AS times, COUNT(DISTINCT rx.patient_id)::int AS patients,
                  COUNT(DISTINCT rx.doctor_id)::int AS doctors
             FROM prescription_medicines pm
             JOIN prescriptions rx ON rx.id = pm.prescription_id
            WHERE rx.organization_id = $1 AND rx.location_id = ANY($2) AND rx.status <> 'DRAFT'
              AND ${utc('rx.created_at')} >= $3 AND ${utc('rx.created_at')} < $4
              AND ($5::uuid IS NULL OR rx.doctor_id = $5::uuid)
            GROUP BY ${normalized('pm.medicine_name')}
            ORDER BY times DESC LIMIT $6`,
          [
            s.organizationId,
            s.locationIds,
            p.start,
            p.end,
            p.doctorId ?? null,
            p.limit,
          ],
        );
        return { rows };
      },
    },
    {
      key: 'follow-ups',
      title: 'Follow-ups',
      description:
        'Follow-ups due in the period — who came back and whom to call.',
      category: 'clinical',
      feature,
      filters: { dates: 'range', doctor: true },
      landscape: true,
      columns: [
        { key: 'due', header: 'Follow-up due', type: 'date' },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2 },
        { key: 'phone', header: 'Phone', type: 'text', weight: 1.3 },
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 1.5 },
        { key: 'lastVisit', header: 'Seen on', type: 'date' },
        { key: 'diagnosis', header: 'Diagnosis', type: 'text', weight: 2.2 },
        { key: 'status', header: 'Status', type: 'text', weight: 1 },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT e.follow_up_date::text AS due, pt.full_name AS patient, pt.phone,
                  emp.full_name AS doctor, ${localDay('e.encounter_date', '$8')}::text AS "lastVisit", e.diagnosis,
                  CASE WHEN EXISTS (SELECT 1 FROM patient_encounters e2
                                     WHERE e2.patient_id = e.patient_id AND e2.location_id = ANY($2)
                                       AND e2.encounter_date > e.encounter_date) THEN 'Came back'
                       WHEN e.follow_up_date < $5::date THEN 'Missed'
                       ELSE 'Upcoming' END AS status
             FROM patient_encounters e ${ENCOUNTER_DOCTOR_JOINS}
             JOIN patients pt ON pt.id = e.patient_id
             LEFT JOIN employees emp ON emp.id = ${ENCOUNTER_DOCTOR}
            WHERE e.organization_id = $1 AND e.location_id = ANY($2)
              AND e.follow_up_date BETWEEN $3 AND $4
              AND ($6::uuid IS NULL OR ${ENCOUNTER_DOCTOR} = $6::uuid)
            ORDER BY e.follow_up_date, pt.full_name
            LIMIT $7`,
          [
            s.organizationId,
            s.locationIds,
            p.from,
            p.to,
            s.today,
            p.doctorId ?? null,
            p.limit,
            s.tz,
          ],
        );
        const count = (st: string) =>
          rows.filter((r) => r.status === st).length;
        return {
          rows,
          summary: [
            { label: 'Came back', value: count('Came back'), type: 'number' },
            { label: 'Missed', value: count('Missed'), type: 'number' },
            { label: 'Upcoming', value: count('Upcoming'), type: 'number' },
          ],
        };
      },
    },
    {
      key: 'lab-turnaround',
      title: 'Lab turnaround',
      description:
        'How fast each lab returns work, on-time rate, late orders and remakes.',
      category: 'lab',
      feature,
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'lab', header: 'Lab', type: 'text', weight: 2 },
        { key: 'orders', header: 'Orders', type: 'number', total: true },
        { key: 'completed', header: 'Completed', type: 'number', total: true },
        { key: 'avgDays', header: 'Avg days', type: 'decimal' },
        { key: 'onTimePct', header: 'On time %', type: 'percent' },
        {
          key: 'lateOpen',
          header: 'Late, still open',
          type: 'number',
          total: true,
        },
        { key: 'remakes', header: 'Remakes', type: 'number', total: true },
      ],
      async run(s, p) {
        // $1 org, $2 locations, $3/$4 days, $5 today, $6 tz, $7/$8 instants
        const rows = await sqlRows<Record<string, string | null>>(
          db,
          `SELECT lb.name AS lab, COUNT(*) AS orders,
                  COUNT(*) FILTER (WHERE o.status_code = 'completed') AS completed,
                  AVG(EXTRACT(EPOCH FROM (o.completed_at - COALESCE(o.submitted_at, o.created_at))) / 86400.0)
                    FILTER (WHERE o.completed_at IS NOT NULL) AS avg_days,
                  COUNT(*) FILTER (WHERE o.completed_at IS NOT NULL AND o.lab_expected_on IS NOT NULL) AS with_due,
                  COUNT(*) FILTER (WHERE o.completed_at IS NOT NULL AND o.lab_expected_on IS NOT NULL
                                     AND ${localDay('o.completed_at', '$6')} <= o.lab_expected_on) AS on_time,
                  COUNT(*) FILTER (WHERE o.status_code NOT IN ${LAB_CLOSED}
                                     AND o.lab_expected_on < $5::date) AS late_open,
                  (SELECT COUNT(*) FROM remake_requests r
                    WHERE r.lab_id = lb.id AND r.organization_id = $1
                      AND r.created_at >= $7 AND r.created_at < $8) AS remakes
             FROM lab_orders o JOIN labs lb ON lb.id = o.lab_id
            WHERE o.organization_id = $1 AND o.location_id = ANY($2) AND o.status_code <> 'draft'
              AND o.requested_on BETWEEN $3 AND $4
            GROUP BY lb.id, lb.name ORDER BY orders DESC`,
          [
            s.organizationId,
            s.locationIds,
            p.from,
            p.to,
            s.today,
            s.tz,
            p.start,
            p.end,
          ],
        );
        return {
          rows: rows.map((r) => ({
            lab: r.lab,
            orders: Number(r.orders),
            completed: Number(r.completed),
            avgDays: round1(r.avg_days),
            onTimePct: percentOfTotal(Number(r.on_time), Number(r.with_due)),
            lateOpen: Number(r.late_open),
            remakes: Number(r.remakes),
          })),
          notes: [
            'Turnaround = sent to the lab → completed. On time = completed by the lab’s expected date.',
          ],
        };
      },
    },
    {
      key: 'lab-delays',
      title: 'Late lab orders',
      description:
        'Open orders past the lab’s promised date — chase these today.',
      category: 'lab',
      feature,
      filters: { dates: 'asOf' },
      landscape: true,
      columns: [
        { key: 'order', header: 'Order #', type: 'text', weight: 1.2 },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2 },
        { key: 'lab', header: 'Lab', type: 'text', weight: 1.8 },
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 1.5 },
        { key: 'requested', header: 'Sent', type: 'date' },
        { key: 'expected', header: 'Promised', type: 'date' },
        { key: 'daysLate', header: 'Days late', type: 'number' },
        { key: 'status', header: 'Status', type: 'text', weight: 1.3 },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT o.order_no AS "order", pt.full_name AS patient, lb.name AS lab, e.full_name AS doctor,
                  o.requested_on::text AS requested, o.lab_expected_on::text AS expected,
                  ($3::date - o.lab_expected_on) AS "daysLate", ${label('o.status_code')} AS status
             FROM lab_orders o
             JOIN labs lb ON lb.id = o.lab_id
             JOIN patients pt ON pt.id = o.patient_id
             LEFT JOIN employees e ON e.id = o.doctor_id
            WHERE o.organization_id = $1 AND o.location_id = ANY($2)
              AND o.status_code NOT IN ${LAB_CLOSED} AND o.lab_expected_on < $3::date
            ORDER BY o.lab_expected_on
            LIMIT $4`,
          [s.organizationId, s.locationIds, s.today, p.limit],
        );
        return { rows };
      },
    },
  ];
}
