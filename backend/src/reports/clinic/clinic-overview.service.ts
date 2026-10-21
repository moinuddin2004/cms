import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addDays } from 'src/common/clock/tz.util';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import { dayCount, monthLabel, previousRange } from '../core/report-dates';
import { percentOfTotal } from '../core/report-format';
import type { ReportParams, ReportScope } from '../core/report.types';
import { LAPSED_DAYS } from '../definitions/patient.reports';
import {
  ENCOUNTER_DOCTOR,
  ENCOUNTER_DOCTOR_JOINS,
  label,
  minutesBetween,
  patientAtLocations,
  round1,
  utc,
} from '../definitions/sql-helpers';
import { changePct } from '../finance/profit-loss';
import type { Period } from '../finance/finance-data.service';

/** Trend buckets: by day up to two weeks, by week up to ~4 months, else by month. */
const DAILY_TREND_MAX_DAYS = 14;
const WEEKLY_TREND_MAX_DAYS = 120;
type TrendUnit = 'day' | 'week' | 'month';

/** `2026-10-06` → `06/10` (day), `6 Oct` (week start), `Oct 26` (month). */
export function trendLabel(unit: TrendUnit, ymd: string): string {
  if (unit === 'month') return monthLabel(ymd.slice(0, 7));
  if (unit === 'day') return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  return `${Number(ymd.slice(8, 10))} ${monthLabel(ymd.slice(0, 7)).slice(0, 3)}`;
}
const TOP_N = 6;

const WAIT = minutesBetween(
  'q.checked_in_at',
  'COALESCE(q.called_at, q.consultation_started_at)',
);
const CONSULT = minutesBetween('q.consultation_started_at', 'q.finished_at');

interface Kpis {
  patientsSeen: number;
  visits: number;
  newPatients: number;
  appointments: number;
  noShowPct: number;
  /** Showed up ÷ appointments that were due; null when none were due. */
  showUpPct: number | null;
  avgWaitMin: number | null;
  avgConsultMin: number | null;
  walkInPct: number;
}

/**
 * The owner's "how is the clinic doing" screen: patients, appointments,
 * waiting and doctors for one period (and the period before it).
 */
@Injectable()
export class ClinicOverviewService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly clock: ClockService,
  ) {}

  async overview(scope: ReportScope, p: ReportParams) {
    const period: Period = {
      from: p.from,
      to: p.to,
      start: p.start,
      end: p.end,
    };
    const prev = previousRange(p.from, p.to);
    const prevPeriod = this.period(scope, prev.from, prev.to);

    const [
      current,
      previous,
      trend,
      heatmap,
      sources,
      doctors,
      status,
      demographics,
      diagnoses,
      treatments,
      attention,
    ] = await Promise.all([
      this.kpis(scope, period),
      this.kpis(scope, prevPeriod),
      this.trend(scope, period),
      this.heatmap(scope, period),
      this.sources(scope, period),
      this.doctors(scope, period),
      this.appointmentStatus(scope, period),
      this.demographics(scope, period),
      this.top(scope, period, 'diagnosis'),
      this.topTreatments(scope, period),
      this.attention(scope),
    ]);

    const kpi = (k: keyof Kpis) => ({
      value: current[k],
      previous: previous[k],
      changePct: changePct(Number(current[k] ?? 0), Number(previous[k] ?? 0)),
    });

    return {
      period: { from: p.from, to: p.to },
      previousPeriod: prev,
      scope: { label: scope.label, locationCount: scope.locationIds.length },
      kpis: {
        patientsSeen: kpi('patientsSeen'),
        visits: kpi('visits'),
        newPatients: kpi('newPatients'),
        appointments: kpi('appointments'),
        noShowPct: kpi('noShowPct'),
        showUpPct: kpi('showUpPct'),
        avgWaitMin: kpi('avgWaitMin'),
        avgConsultMin: kpi('avgConsultMin'),
        walkInPct: kpi('walkInPct'),
      },
      trend,
      heatmap,
      sources,
      doctors,
      appointmentStatus: status,
      demographics,
      topDiagnoses: diagnoses,
      topTreatments: treatments,
      attention,
    };
  }

  private period(scope: ReportScope, from: string, to: string): Period {
    return {
      from,
      to,
      start: this.clock.dayRange(scope.tz, from).start,
      end: this.clock.dayRange(scope.tz, addDays(to, 1)).start,
    };
  }

  private async kpis(scope: ReportScope, period: Period): Promise<Kpis> {
    // $1 org, $2 locations, $3/$4 days, $5/$6 instants, $7 whole org
    const [r] = await sqlRows<Record<string, string | null>>(
      this.db,
      `SELECT
         (SELECT COUNT(DISTINCT patient_id) FROM patient_encounters
           WHERE organization_id = $1 AND location_id = ANY($2) AND encounter_date >= $5 AND encounter_date < $6) AS seen,
         (SELECT COUNT(*) FROM patient_encounters
           WHERE organization_id = $1 AND location_id = ANY($2) AND encounter_date >= $5 AND encounter_date < $6) AS visits,
         (SELECT COUNT(*) FROM patients p
           WHERE p.organization_id = $1 AND p.deleted_at IS NULL AND ${patientAtLocations('p', '$2', '$7')}
             AND ${utc('p.created_at')} >= $5 AND ${utc('p.created_at')} < $6) AS new_patients,
         (SELECT COUNT(*) FROM appointments
           WHERE organization_id = $1 AND location_id = ANY($2) AND start_time >= $5 AND start_time < $6) AS booked,
         (SELECT COUNT(*) FROM appointments
           WHERE organization_id = $1 AND location_id = ANY($2) AND start_time >= $5 AND start_time < $6
             AND status = 'no_show') AS no_show,
         (SELECT COUNT(*) FROM appointments
           WHERE organization_id = $1 AND location_id = ANY($2) AND start_time >= $5 AND start_time < $6
             AND status IN ('completed', 'checked_in', 'no_show')) AS due,
         q.avg_wait, q.avg_consult, q.walk_in, q.arrivals
       FROM (SELECT
               AVG(${WAIT}) FILTER (WHERE COALESCE(q.called_at, q.consultation_started_at) IS NOT NULL) AS avg_wait,
               AVG(${CONSULT}) FILTER (WHERE q.status = 'completed' AND q.consultation_started_at IS NOT NULL) AS avg_consult,
               COUNT(*) FILTER (WHERE q.queue_type = 'walk_in') AS walk_in,
               COUNT(*) AS arrivals
               FROM queue_entries q JOIN queue_sessions qs ON qs.id = q.queue_session_id
              WHERE qs.organization_id = $1 AND qs.location_id = ANY($2)
                AND qs.service_date BETWEEN $3 AND $4 AND q.status <> 'transferred') q`,
      [
        scope.organizationId,
        scope.locationIds,
        period.from,
        period.to,
        period.start,
        period.end,
        scope.wholeOrg,
      ],
    );
    const n = (k: string) => Number(r?.[k] ?? 0);
    return {
      patientsSeen: n('seen'),
      visits: n('visits'),
      newPatients: n('new_patients'),
      appointments: n('booked'),
      noShowPct: percentOfTotal(n('no_show'), n('due')),
      showUpPct: n('due')
        ? percentOfTotal(n('due') - n('no_show'), n('due'))
        : null,
      avgWaitMin: round1(r?.avg_wait),
      avgConsultMin: round1(r?.avg_consult),
      walkInPct: percentOfTotal(n('walk_in'), n('arrivals')),
    };
  }

  /**
   * Visits (first-ever vs returning), new registrations, appointments,
   * show-up rate and waiting per day, week or month — whichever keeps the
   * chart readable for the range.
   */
  private async trend(scope: ReportScope, period: Period) {
    const days = dayCount(period.from, period.to);
    const unit: TrendUnit =
      days <= DAILY_TREND_MAX_DAYS
        ? 'day'
        : days <= WEEKLY_TREND_MAX_DAYS
          ? 'week'
          : 'month';
    const bucket = (dateExpr: string) =>
      `to_char(date_trunc('${unit}', ${dateExpr}), 'YYYY-MM-DD')`;
    const encDay = `(e.encounter_date AT TIME ZONE $5)::date`;
    // $1 org, $2 locations, $3/$4 days, $5 tz, $6 whole org
    const rows = await sqlRows<Record<string, string | null>>(
      this.db,
      `WITH b AS (SELECT to_char(d, 'YYYY-MM-DD') AS bucket
                    FROM generate_series(date_trunc('${unit}', $3::date), $4::date, interval '1 ${unit}') d),
       v AS (SELECT ${bucket(encDay)} AS bucket, COUNT(*) AS visits,
                    COUNT(*) FILTER (WHERE NOT EXISTS (
                      SELECT 1 FROM patient_encounters e2
                       WHERE e2.patient_id = e.patient_id AND e2.location_id = ANY($2)
                         AND e2.encounter_date < e.encounter_date)) AS new_visits
               FROM patient_encounters e
              WHERE e.organization_id = $1 AND e.location_id = ANY($2) AND ${encDay} BETWEEN $3 AND $4
              GROUP BY 1),
       np AS (SELECT ${bucket(`(${utc('p.created_at')} AT TIME ZONE $5)::date`)} AS bucket, COUNT(*) AS n
                FROM patients p
               WHERE p.organization_id = $1 AND p.deleted_at IS NULL AND ${patientAtLocations('p', '$2', '$6')}
                 AND (${utc('p.created_at')} AT TIME ZONE $5)::date BETWEEN $3 AND $4
               GROUP BY 1),
       ap AS (SELECT ${bucket('(start_time AT TIME ZONE $5)::date')} AS bucket, COUNT(*) AS n,
                     COUNT(*) FILTER (WHERE status = 'no_show') AS no_show,
                     COUNT(*) FILTER (WHERE status IN ('completed', 'checked_in', 'no_show')) AS due
                FROM appointments
               WHERE organization_id = $1 AND location_id = ANY($2)
                 AND (start_time AT TIME ZONE $5)::date BETWEEN $3 AND $4
               GROUP BY 1),
       qw AS (SELECT ${bucket('qs.service_date')} AS bucket,
                     AVG(${WAIT}) FILTER (WHERE COALESCE(q.called_at, q.consultation_started_at) IS NOT NULL) AS avg_wait
                FROM queue_entries q JOIN queue_sessions qs ON qs.id = q.queue_session_id
               WHERE qs.organization_id = $1 AND qs.location_id = ANY($2)
                 AND qs.service_date BETWEEN $3 AND $4 AND q.status <> 'transferred'
               GROUP BY 1)
       SELECT b.bucket, COALESCE(v.visits, 0) AS visits, COALESCE(v.new_visits, 0) AS new_visits,
              COALESCE(np.n, 0) AS new_patients, COALESCE(ap.n, 0) AS appointments,
              COALESCE(ap.no_show, 0) AS no_show, COALESCE(ap.due, 0) AS due, qw.avg_wait
         FROM b LEFT JOIN v USING (bucket) LEFT JOIN np USING (bucket)
         LEFT JOIN ap USING (bucket) LEFT JOIN qw USING (bucket)
        ORDER BY b.bucket`,
      [
        scope.organizationId,
        scope.locationIds,
        period.from,
        period.to,
        scope.tz,
        scope.wholeOrg,
      ],
    );
    return {
      unit,
      points: rows.map((r) => {
        const n = (k: string) => Number(r[k] ?? 0);
        const key = String(r.bucket);
        return {
          key,
          // The first week can start before the period: label it by the period start.
          label: trendLabel(
            unit,
            unit === 'week' && key < period.from ? period.from : key,
          ),
          visits: n('visits'),
          newVisits: n('new_visits'),
          returningVisits: n('visits') - n('new_visits'),
          newPatients: n('new_patients'),
          appointments: n('appointments'),
          showUpPct: n('due')
            ? percentOfTotal(n('due') - n('no_show'), n('due'))
            : null,
          avgWaitMin: round1(r.avg_wait),
        };
      }),
    };
  }

  /** Check-ins by weekday (1 = Mon) × hour. */
  private async heatmap(scope: ReportScope, period: Period) {
    const rows = await sqlRows<{ dow: number; hour: number; n: string }>(
      this.db,
      `SELECT EXTRACT(ISODOW FROM q.checked_in_at AT TIME ZONE $5)::int AS dow,
              EXTRACT(HOUR FROM q.checked_in_at AT TIME ZONE $5)::int AS hour, COUNT(*) AS n
         FROM queue_entries q JOIN queue_sessions qs ON qs.id = q.queue_session_id
        WHERE qs.organization_id = $1 AND qs.location_id = ANY($2)
          AND qs.service_date BETWEEN $3 AND $4 AND q.status <> 'transferred'
          AND q.checked_in_at IS NOT NULL
        GROUP BY 1, 2`,
      [
        scope.organizationId,
        scope.locationIds,
        period.from,
        period.to,
        scope.tz,
      ],
    );
    return rows.map((r) => ({ dow: r.dow, hour: r.hour, count: Number(r.n) }));
  }

  private async sources(scope: ReportScope, period: Period) {
    const rows = await sqlRows<{ source: string; n: string }>(
      this.db,
      `SELECT ${label('p.source')} AS source, COUNT(*) AS n FROM patients p
        WHERE p.organization_id = $1 AND p.deleted_at IS NULL AND ${patientAtLocations('p', '$2', '$5')}
          AND ${utc('p.created_at')} >= $3 AND ${utc('p.created_at')} < $4
        GROUP BY 1 ORDER BY 2 DESC`,
      [
        scope.organizationId,
        scope.locationIds,
        period.start,
        period.end,
        scope.wholeOrg,
      ],
    );
    return rows.map((r) => ({ label: r.source, count: Number(r.n) }));
  }

  /** Per doctor: visits, patients and the waiting / consultation they run. */
  private async doctors(scope: ReportScope, period: Period) {
    const rows = await sqlRows<Record<string, string | null>>(
      this.db,
      `WITH v AS (
         SELECT ${ENCOUNTER_DOCTOR} AS doctor_id, COUNT(*) AS visits, COUNT(DISTINCT e.patient_id) AS patients
           FROM patient_encounters e ${ENCOUNTER_DOCTOR_JOINS}
          WHERE e.organization_id = $1 AND e.location_id = ANY($2)
            AND e.encounter_date >= $5 AND e.encounter_date < $6
          GROUP BY 1),
       w AS (
         SELECT qs.doctor_id,
                AVG(${WAIT}) FILTER (WHERE COALESCE(q.called_at, q.consultation_started_at) IS NOT NULL) AS avg_wait,
                AVG(${CONSULT}) FILTER (WHERE q.status = 'completed' AND q.consultation_started_at IS NOT NULL) AS avg_consult
           FROM queue_entries q JOIN queue_sessions qs ON qs.id = q.queue_session_id
          WHERE qs.organization_id = $1 AND qs.location_id = ANY($2)
            AND qs.service_date BETWEEN $3 AND $4 AND q.status <> 'transferred'
          GROUP BY 1)
       SELECT v.doctor_id, COALESCE(e.full_name, 'No doctor') AS name, v.visits, v.patients,
              w.avg_wait, w.avg_consult
         FROM v LEFT JOIN w ON w.doctor_id IS NOT DISTINCT FROM v.doctor_id
         LEFT JOIN employees e ON e.id = v.doctor_id
        ORDER BY v.visits DESC LIMIT ${TOP_N + 2}`,
      [
        scope.organizationId,
        scope.locationIds,
        period.from,
        period.to,
        period.start,
        period.end,
      ],
    );
    return rows.map((r) => ({
      doctorId: r.doctor_id,
      name: r.name,
      visits: Number(r.visits),
      patients: Number(r.patients),
      avgWaitMin: round1(r.avg_wait),
      avgConsultMin: round1(r.avg_consult),
    }));
  }

  private async appointmentStatus(scope: ReportScope, period: Period) {
    const rows = await sqlRows<{ status: string; n: string }>(
      this.db,
      `SELECT status::text AS status, COUNT(*) AS n FROM appointments
        WHERE organization_id = $1 AND location_id = ANY($2) AND start_time >= $3 AND start_time < $4
        GROUP BY 1`,
      [scope.organizationId, scope.locationIds, period.start, period.end],
    );
    const by = new Map(rows.map((r) => [r.status, Number(r.n)]));
    return [
      { key: 'completed', label: 'Completed', count: by.get('completed') ?? 0 },
      {
        key: 'checked_in',
        label: 'In clinic',
        count: by.get('checked_in') ?? 0,
      },
      {
        key: 'pending',
        label: 'Not yet',
        count: (by.get('scheduled') ?? 0) + (by.get('confirmed') ?? 0),
      },
      { key: 'cancelled', label: 'Cancelled', count: by.get('cancelled') ?? 0 },
      { key: 'no_show', label: 'No-show', count: by.get('no_show') ?? 0 },
    ];
  }

  /** Gender and age groups of the patients seen. */
  private async demographics(scope: ReportScope, period: Period) {
    const rows = await sqlRows<{ dim: string; grp: string; n: string }>(
      this.db,
      `WITH pp AS (
         SELECT p.gender, date_part('year', age($5::date, p.dob)) AS age
           FROM patients p
          WHERE p.id IN (SELECT patient_id FROM patient_encounters
                          WHERE organization_id = $1 AND location_id = ANY($2)
                            AND encounter_date >= $3 AND encounter_date < $4))
       SELECT 'gender' AS dim, COALESCE(${label('gender')}, 'Not recorded') AS grp, COUNT(*) AS n FROM pp GROUP BY 2
       UNION ALL
       SELECT 'age', CASE WHEN age IS NULL THEN 'Not recorded' WHEN age < 18 THEN 'Under 18'
                          WHEN age < 30 THEN '18–29' WHEN age < 45 THEN '30–44' WHEN age < 60 THEN '45–59'
                          ELSE '60+' END, COUNT(*) FROM pp GROUP BY 2`,
      [
        scope.organizationId,
        scope.locationIds,
        period.start,
        period.end,
        scope.today,
      ],
    );
    const ageOrder = [
      'Under 18',
      '18–29',
      '30–44',
      '45–59',
      '60+',
      'Not recorded',
    ];
    const pick = (dim: string) =>
      rows
        .filter((r) => r.dim === dim)
        .map((r) => ({ label: r.grp, count: Number(r.n) }));
    return {
      gender: pick('gender').sort((a, b) => b.count - a.count),
      age: pick('age').sort(
        (a, b) => ageOrder.indexOf(a.label) - ageOrder.indexOf(b.label),
      ),
    };
  }

  private async top(scope: ReportScope, period: Period, column: 'diagnosis') {
    const rows = await sqlRows<{ text: string; n: string }>(
      this.db,
      `SELECT MIN(trim(${column})) AS text, COUNT(*) AS n FROM patient_encounters
        WHERE organization_id = $1 AND location_id = ANY($2) AND encounter_date >= $3 AND encounter_date < $4
          AND NULLIF(trim(${column}), '') IS NOT NULL
        GROUP BY lower(regexp_replace(trim(${column}), '\\s+', ' ', 'g'))
        ORDER BY 2 DESC LIMIT ${TOP_N}`,
      [scope.organizationId, scope.locationIds, period.start, period.end],
    );
    return rows.map((r) => ({ label: r.text, count: Number(r.n) }));
  }

  private async topTreatments(scope: ReportScope, period: Period) {
    const rows = await sqlRows<{ text: string; n: string }>(
      this.db,
      `SELECT MIN(trim(treatment_name)) AS text, COUNT(*) AS n FROM treatments
        WHERE organization_id = $1 AND location_id = ANY($2) AND date >= $3 AND date < $4
        GROUP BY lower(regexp_replace(trim(treatment_name), '\\s+', ' ', 'g'))
        ORDER BY 2 DESC LIMIT ${TOP_N}`,
      [scope.organizationId, scope.locationIds, period.start, period.end],
    );
    return rows.map((r) => ({ label: r.text, count: Number(r.n) }));
  }

  /** Lists that need someone to act today (independent of the period). */
  private async attention(scope: ReportScope) {
    const [r] = await sqlRows<Record<string, string>>(
      this.db,
      `SELECT
         (SELECT COUNT(*) FROM patient_encounters e
           WHERE e.organization_id = $1 AND e.location_id = ANY($2)
             AND e.follow_up_date BETWEEN $3::date - 30 AND $3::date - 1
             AND NOT EXISTS (SELECT 1 FROM patient_encounters e2
                              WHERE e2.patient_id = e.patient_id AND e2.location_id = ANY($2)
                                AND e2.encounter_date > e.encounter_date)) AS missed_follow_ups,
         (SELECT COUNT(*) FROM patient_encounters e
           WHERE e.organization_id = $1 AND e.location_id = ANY($2)
             AND e.follow_up_date BETWEEN $3::date AND $3::date + 7) AS upcoming_follow_ups,
         (SELECT COUNT(*) FROM (
            SELECT e.patient_id FROM patient_encounters e
             WHERE e.organization_id = $1 AND e.location_id = ANY($2)
             GROUP BY 1 HAVING (MAX(e.encounter_date) AT TIME ZONE $4)::date < $3::date - ${LAPSED_DAYS}) x) AS lapsed,
         (SELECT COUNT(*) FROM appointments a
           WHERE a.organization_id = $1 AND a.location_id = ANY($2) AND a.status = 'no_show'
             AND (a.start_time AT TIME ZONE $4)::date BETWEEN $3::date - 30 AND $3::date
             AND NOT EXISTS (SELECT 1 FROM appointments a2
                              WHERE a2.patient_id = a.patient_id AND a2.start_time > a.start_time
                                AND a2.status IN ('scheduled', 'confirmed', 'checked_in', 'completed'))
             AND NOT EXISTS (SELECT 1 FROM patient_encounters e3
                              WHERE e3.patient_id = a.patient_id AND e3.encounter_date > a.start_time)) AS no_shows_to_call,
         (SELECT COUNT(*) FROM lab_orders
           WHERE organization_id = $1 AND location_id = ANY($2)
             AND status_code NOT IN ('draft', 'cancelled', 'completed', 'rejected_by_lab')
             AND lab_expected_on < $3::date) AS late_lab`,
      [scope.organizationId, scope.locationIds, scope.today, scope.tz],
    );
    const n = (k: string) => Number(r?.[k] ?? 0);
    return {
      missedFollowUps: n('missed_follow_ups'),
      upcomingFollowUps: n('upcoming_follow_ups'),
      lapsedPatients: n('lapsed'),
      noShowsToCall: n('no_shows_to_call'),
      lateLabOrders: n('late_lab'),
    };
  }
}
