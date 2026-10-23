import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { percentOfTotal } from '../core/report-format';
import type { ReportDefinition, ReportRow } from '../core/report.types';
import { REPORTS_CLINICAL_FEATURE } from '../reports.constants';
import { label, localDay, patientAtLocations, utc } from './sql-helpers';

/** Patients not seen for this many days count as lapsed. */
export const LAPSED_DAYS = 180;

const AGE_ORDER = [
  '0–12',
  '13–17',
  '18–29',
  '30–44',
  '45–59',
  '60+',
  'Not recorded',
];
const AGE_BUCKET = `CASE WHEN age IS NULL THEN 'Not recorded' WHEN age < 13 THEN '0–12'
  WHEN age < 18 THEN '13–17' WHEN age < 30 THEN '18–29' WHEN age < 45 THEN '30–44'
  WHEN age < 60 THEN '45–59' ELSE '60+' END`;

/** Who the patients are, where they come from and who stopped coming. */
export function patientReports(db: DataSource): ReportDefinition[] {
  const feature = REPORTS_CLINICAL_FEATURE;
  return [
    {
      key: 'new-patients',
      title: 'New patients',
      description:
        'Everyone registered in the period, with source, age and city.',
      category: 'patients',
      feature,
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'date', header: 'Registered', type: 'date' },
        { key: 'patientNo', header: 'MR #', type: 'text', weight: 1 },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2.2 },
        { key: 'phone', header: 'Phone', type: 'text', weight: 1.3 },
        { key: 'gender', header: 'Gender', type: 'text', weight: 0.8 },
        { key: 'age', header: 'Age', type: 'number', weight: 0.6 },
        { key: 'city', header: 'City', type: 'text', weight: 1.1 },
        { key: 'source', header: 'Came from', type: 'text', weight: 1.2 },
        { key: 'referredBy', header: 'Referred by', type: 'text', weight: 1.4 },
        {
          key: 'visits',
          header: 'Visits',
          type: 'number',
          total: true,
          weight: 0.7,
        },
      ],
      async run(s, p) {
        // $1 org, $2 locations, $3/$4 instants, $5 tz, $6 today, $7 whole org, $8 limit
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT to_char(${utc('p.created_at')} AT TIME ZONE $5, 'YYYY-MM-DD') AS date,
                  p.patient_number AS "patientNo", p.full_name AS patient, p.phone,
                  ${label('p.gender')} AS gender,
                  date_part('year', age($6::date, p.dob))::int AS age,
                  NULLIF(initcap(trim(p.city)), '') AS city,
                  ${label('p.source')} AS source, p.referred_by_text AS "referredBy",
                  (SELECT COUNT(*) FROM patient_encounters e
                    WHERE e.patient_id = p.id AND e.location_id = ANY($2))::int AS visits
             FROM patients p
            WHERE p.organization_id = $1 AND p.deleted_at IS NULL
              AND ${patientAtLocations('p', '$2', '$7')}
              AND ${utc('p.created_at')} >= $3 AND ${utc('p.created_at')} < $4
            ORDER BY p.created_at DESC
            LIMIT $8`,
          [
            s.organizationId,
            s.locationIds,
            p.start,
            p.end,
            s.tz,
            s.today,
            s.wholeOrg,
            p.limit,
          ],
        );
        const visited = rows.filter((r) => Number(r.visits) > 0).length;
        return {
          rows,
          summary: [
            { label: 'New patients', value: rows.length, type: 'number' },
            { label: 'Came for a visit', value: visited, type: 'number' },
            {
              label: 'Visit rate',
              value: percentOfTotal(visited, rows.length),
              type: 'percent',
            },
          ],
        };
      },
    },
    {
      key: 'patient-sources',
      title: 'Where patients come from',
      description:
        'New patients by source — and how many of them came and paid.',
      category: 'patients',
      feature,
      filters: { dates: 'range' },
      columns: [
        { key: 'source', header: 'Source', type: 'text', weight: 1.6 },
        {
          key: 'patients',
          header: 'New patients',
          type: 'number',
          total: true,
        },
        { key: 'share', header: 'Share', type: 'percent' },
        {
          key: 'visited',
          header: 'Came for a visit',
          type: 'number',
          total: true,
        },
        { key: 'conversion', header: 'Visit rate', type: 'percent' },
        { key: 'billed', header: 'Billed so far', type: 'money', total: true },
        { key: 'perPatient', header: 'Per patient', type: 'money' },
      ],
      async run(s, p) {
        const rows = await sqlRows<{
          source: string;
          patients: string;
          visited: string;
          billed: string;
        }>(
          db,
          `WITH np AS (
             SELECT p.source,
                    EXISTS (SELECT 1 FROM patient_encounters e
                             WHERE e.patient_id = p.id AND e.location_id = ANY($2)) AS visited,
                    COALESCE((SELECT SUM(c.net_amount) FROM charges c JOIN invoices i ON i.id = c.invoice_id
                               WHERE c.patient_id = p.id AND c.location_id = ANY($2)
                                 AND c.status = 'ACTIVE' AND i.status = 'ISSUED'), 0) AS billed
               FROM patients p
              WHERE p.organization_id = $1 AND p.deleted_at IS NULL
                AND ${patientAtLocations('p', '$2', '$5')}
                AND ${utc('p.created_at')} >= $3 AND ${utc('p.created_at')} < $4)
           SELECT ${label('source')} AS source, COUNT(*) AS patients,
                  COUNT(*) FILTER (WHERE visited) AS visited,
                  (SUM(billed) * 100)::bigint AS billed
             FROM np GROUP BY np.source ORDER BY 2 DESC`,
          [s.organizationId, s.locationIds, p.start, p.end, s.wholeOrg],
        );
        const total = rows.reduce((a, r) => a + Number(r.patients), 0);
        return {
          rows: rows.map((r) => {
            const patients = Number(r.patients);
            const visited = Number(r.visited);
            const billed = Number(r.billed);
            return {
              source: r.source,
              patients,
              share: percentOfTotal(patients, total),
              visited,
              conversion: percentOfTotal(visited, patients),
              billed,
              perPatient: patients ? Math.round(billed / patients) : 0,
            };
          }),
          notes: [
            '"Billed so far" is everything billed to these patients since they registered.',
          ],
        };
      },
    },
    {
      key: 'patient-demographics',
      title: 'Patient demographics',
      description:
        'Patients seen in the period by visit type, gender, age group and city.',
      category: 'patients',
      feature,
      filters: { dates: 'range' },
      columns: [
        { key: 'dimension', header: 'By', type: 'text', weight: 1.2 },
        { key: 'group', header: 'Group', type: 'text', weight: 1.8 },
        { key: 'patients', header: 'Patients', type: 'number' },
        { key: 'share', header: 'Share', type: 'percent' },
      ],
      async run(s, p) {
        // $1 org, $2 locations, $3/$4 days, $5 today
        const rows = await sqlRows<{
          dimension: string;
          grp: string;
          n: string;
        }>(
          db,
          `WITH seen AS (
             SELECT e.patient_id
               FROM patient_encounters e
              WHERE e.organization_id = $1 AND e.location_id = ANY($2)
                AND e.encounter_date >= $3 AND e.encounter_date < $4
              GROUP BY 1),
           pp AS (
             SELECT p.gender, p.city, date_part('year', age($5::date, p.dob)) AS age,
                    EXISTS (SELECT 1 FROM patient_encounters e2
                             WHERE e2.patient_id = p.id AND e2.location_id = ANY($2)
                               AND e2.encounter_date < $3) AS is_returning
               FROM seen JOIN patients p ON p.id = seen.patient_id)
           SELECT 'Visit type' AS dimension,
                  CASE WHEN is_returning THEN 'Returning' ELSE 'First visit' END AS grp, COUNT(*) AS n FROM pp GROUP BY 2
           UNION ALL
           SELECT 'Gender', COALESCE(${label('gender')}, 'Not recorded'), COUNT(*) FROM pp GROUP BY 2
           UNION ALL
           SELECT 'Age group', ${AGE_BUCKET}, COUNT(*) FROM pp GROUP BY 2
           UNION ALL
           SELECT 'City', COALESCE(NULLIF(initcap(trim(city)), ''), 'Not recorded'), COUNT(*) FROM pp GROUP BY 2`,
          [s.organizationId, s.locationIds, p.start, p.end, s.today],
        );
        const order = ['Visit type', 'Gender', 'Age group', 'City'];
        const totals = new Map<string, number>();
        for (const r of rows)
          totals.set(r.dimension, (totals.get(r.dimension) ?? 0) + Number(r.n));
        const sorted = [...rows].sort((a, b) => {
          const d = order.indexOf(a.dimension) - order.indexOf(b.dimension);
          if (d) return d;
          if (a.dimension === 'Age group')
            return AGE_ORDER.indexOf(a.grp) - AGE_ORDER.indexOf(b.grp);
          return Number(b.n) - Number(a.n);
        });
        const seen = totals.get('Gender') ?? 0;
        return {
          rows: sorted.map((r) => ({
            dimension: r.dimension,
            group: r.grp,
            patients: Number(r.n),
            share: percentOfTotal(Number(r.n), totals.get(r.dimension) ?? 0),
          })),
          totals: null,
          summary: [{ label: 'Patients seen', value: seen, type: 'number' }],
          notes: [
            'Age is today’s age from date of birth. "Returning" had a visit before this period.',
          ],
        };
      },
    },
    {
      key: 'lapsed-patients',
      title: 'Patients who stopped coming',
      description: `Not seen for ${LAPSED_DAYS / 30}+ months — a call list, most valuable first.`,
      category: 'patients',
      feature,
      filters: { dates: 'asOf' },
      landscape: true,
      columns: [
        { key: 'patient', header: 'Patient', type: 'text', weight: 2.2 },
        { key: 'patientNo', header: 'MR #', type: 'text', weight: 1 },
        { key: 'phone', header: 'Phone', type: 'text', weight: 1.3 },
        { key: 'lastVisit', header: 'Last visit', type: 'date' },
        { key: 'daysAway', header: 'Days away', type: 'number' },
        { key: 'visits', header: 'Visits', type: 'number' },
        {
          key: 'lastDiagnosis',
          header: 'Last diagnosis',
          type: 'text',
          weight: 2,
        },
        {
          key: 'billed',
          header: 'Billed (lifetime)',
          type: 'money',
          total: true,
        },
        { key: 'owes', header: 'Owes', type: 'money', total: true },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `WITH last AS (
             SELECT e.patient_id, ${localDay('MAX(e.encounter_date)', '$5')} AS last_visit, COUNT(*) AS visits
               FROM patient_encounters e
              WHERE e.organization_id = $1 AND e.location_id = ANY($2)
              GROUP BY 1)
           SELECT p.full_name AS patient, p.patient_number AS "patientNo", p.phone,
                  last.last_visit::text AS "lastVisit", ($3::date - last.last_visit) AS "daysAway",
                  last.visits::int AS visits,
                  (SELECT e.diagnosis FROM patient_encounters e
                    WHERE e.patient_id = p.id AND e.location_id = ANY($2) AND e.diagnosis IS NOT NULL
                    ORDER BY e.encounter_date DESC LIMIT 1) AS "lastDiagnosis",
                  COALESCE((SELECT SUM(c.net_amount) * 100 FROM charges c JOIN invoices i ON i.id = c.invoice_id
                             WHERE c.patient_id = p.id AND c.location_id = ANY($2)
                               AND c.status = 'ACTIVE' AND i.status = 'ISSUED'), 0)::bigint AS billed,
                  COALESCE((SELECT SUM(i.balance_due) * 100 FROM invoices i
                             WHERE i.patient_id = p.id AND i.location_id = ANY($2)
                               AND i.status = 'ISSUED'), 0)::bigint AS owes
             FROM last JOIN patients p ON p.id = last.patient_id AND p.deleted_at IS NULL AND p.is_active
            WHERE last.last_visit < $3::date - ${LAPSED_DAYS}
            ORDER BY billed DESC, last.last_visit DESC
            LIMIT $4`,
          [s.organizationId, s.locationIds, s.today, p.limit, s.tz],
        );
        return {
          rows,
          notes: [
            `Patients whose last visit is more than ${LAPSED_DAYS} days ago.`,
          ],
        };
      },
    },
    {
      key: 'top-patients',
      title: 'Top patients',
      description: 'Patients with the most billing and visits in the period.',
      category: 'patients',
      feature,
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'patient', header: 'Patient', type: 'text', weight: 2.2 },
        { key: 'patientNo', header: 'MR #', type: 'text', weight: 1 },
        { key: 'phone', header: 'Phone', type: 'text', weight: 1.3 },
        { key: 'visits', header: 'Visits', type: 'number', total: true },
        { key: 'billed', header: 'Billed', type: 'money', total: true },
        { key: 'paid', header: 'Paid', type: 'money', total: true },
        { key: 'owes', header: 'Owes now', type: 'money', total: true },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `WITH b AS (
             SELECT c.patient_id, SUM(c.net_amount + c.tax_amount) AS billed, SUM(c.allocated_amount) AS paid
               FROM charges c JOIN invoices i ON i.id = c.invoice_id
              WHERE c.organization_id = $1 AND c.location_id = ANY($2) AND c.status = 'ACTIVE'
                AND i.status = 'ISSUED' AND i.issue_date BETWEEN $3 AND $4
              GROUP BY 1),
           v AS (
             SELECT patient_id, COUNT(*) AS visits FROM patient_encounters
              WHERE organization_id = $1 AND location_id = ANY($2)
                AND encounter_date >= $6 AND encounter_date < $7
              GROUP BY 1)
           SELECT p.full_name AS patient, p.patient_number AS "patientNo", p.phone,
                  COALESCE(v.visits, 0)::int AS visits,
                  (COALESCE(b.billed, 0) * 100)::bigint AS billed,
                  (COALESCE(b.paid, 0) * 100)::bigint AS paid,
                  COALESCE((SELECT SUM(i.balance_due) * 100 FROM invoices i
                             WHERE i.patient_id = p.id AND i.location_id = ANY($2)
                               AND i.status = 'ISSUED'), 0)::bigint AS owes
             FROM b FULL JOIN v USING (patient_id)
             JOIN patients p ON p.id = patient_id
            ORDER BY COALESCE(b.billed, 0) DESC, COALESCE(v.visits, 0) DESC
            LIMIT $5`,
          [
            s.organizationId,
            s.locationIds,
            p.from,
            p.to,
            p.limit,
            p.start,
            p.end,
          ],
        );
        return { rows };
      },
    },
  ];
}
