import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { PrescriptionPdfService } from 'src/prescriptions/services/prescription-pdf.service';
import { ClockService } from 'src/common/clock/clock.service';
import { toMinor } from 'src/billing/common/money';
import {
  assertProfile,
  linkedPatientWhere,
  PatientContext,
} from '../context/patient-context';
import { PatientAccessLogService } from './patient-access-log.service';
import { PatientClinicsService, VisibleScope } from './patient-clinics.service';
import {
  AppointmentRow,
  InvoiceRow,
  mapAppointment,
  mapInvoice,
  mapPrescription,
  mapPrescriptionDetail,
  mapVisit,
  MedicineRow,
  PrescriptionRow,
  VisitRow,
} from './patient-reads.mappers';
import type {
  PagedDto,
  PatientAppointmentDto,
  PatientBillingClinicDto,
  PatientPrescriptionDetailDto,
  PatientPrescriptionDto,
  PatientVisitDto,
} from './patient-reads.types';
import {
  canSeeBilling,
  canSeeDiagnosis,
  PRESCRIPTION_VISIBLE_STATUSES,
} from './visibility';

interface Scoped {
  organizationId: string;
  patientId: string;
}

const LOCATION_COLUMNS = [
  'l.id AS "locationId"',
  'l.name AS "locationName"',
  'l.timezone AS "locationTimezone"',
  'l.phone AS "locationPhone"',
  'l.address AS "locationAddress"',
];

const MAX_APPOINTMENTS = 300;
const MAX_INVOICES_PER_CLINIC = 50;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });

/**
 * Read-only patient views (M2-08). Every query is scoped with
 * `linkedPatientWhere()` over the *visible* context (clinics that are
 * approved; A-19). Nothing from the URL is trusted without that scope.
 */
@Injectable()
export class PatientReadsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clinics: PatientClinicsService,
    private readonly accessLog: PatientAccessLogService,
    private readonly clock: ClockService,
    private readonly pdfs: PrescriptionPdfService,
  ) {}

  // ── helpers ────────────────────────────────────────────────────────

  /**
   * (org, patient) -> profile id. With an explicit `profileId` filter every
   * row belongs to that profile, so it labels rows directly.
   */
  private profileLookup(ctx: PatientContext, forcedProfileId?: string) {
    if (forcedProfileId !== undefined) return () => forcedProfileId;
    const map = new Map<string, string>();
    for (const l of ctx.links) {
      const key = `${l.organizationId}:${l.patientId}`;
      if (!map.has(key)) map.set(key, l.profileId);
    }
    return (row: Scoped): string | undefined =>
      map.get(`${row.organizationId}:${row.patientId}`);
  }

  private async scope(
    ctx: PatientContext,
    profileId?: string,
  ): Promise<VisibleScope> {
    if (profileId !== undefined) assertProfile(ctx, profileId);
    return this.clinics.visibleScope(ctx);
  }

  private page(page?: number, limit?: number) {
    const p = page ?? 1;
    const l = limit ?? 20;
    return { page: p, limit: l, offset: (p - 1) * l };
  }

  private paged<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PagedDto<T> {
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private qb(): SelectQueryBuilder<object> {
    return this.dataSource.createQueryBuilder();
  }

  // ── appointments ───────────────────────────────────────────────────

  async appointments(
    ctx: PatientContext,
    q: { profileId?: string; from?: string; to?: string },
  ): Promise<PatientAppointmentDto[]> {
    const scope = await this.scope(ctx, q.profileId);
    const qb = this.qb()
      .select([
        'a.id AS "id"',
        'a.organization_id AS "organizationId"',
        'a.patient_id AS "patientId"',
        'a.start_time AS "startTime"',
        'a.end_time AS "endTime"',
        'a.status AS "status"',
        'a.type AS "type"',
        'd.full_name AS "doctorName"',
        ...LOCATION_COLUMNS,
      ])
      .from('appointments', 'a')
      .innerJoin('locations', 'l', 'l.id = a.location_id')
      .leftJoin('employees', 'd', 'd.id = a.doctor_id');
    linkedPatientWhere(qb, scope.ctx, { alias: 'a', profileId: q.profileId });
    if (q.from)
      qb.andWhere('a.start_time >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('a.start_time < :to', { to: new Date(q.to) });
    const rows = await qb
      .orderBy('a.start_time', 'DESC')
      .limit(MAX_APPOINTMENTS)
      .getRawMany<AppointmentRow & Scoped>();

    const profileOf = this.profileLookup(scope.ctx, q.profileId);
    const out = rows.flatMap((r) => {
      const profileId = profileOf(r);
      const clinic = scope.clinics.get(r.organizationId)?.ref;
      return profileId && clinic ? [mapAppointment(r, profileId, clinic)] : [];
    });
    await this.accessLog.record(
      ctx.accountId,
      rows.map((r) => ({
        profileId: profileOf(r) ?? null,
        organizationId: r.organizationId,
        patientId: r.patientId,
        action: 'view_list',
        resourceType: 'appointment',
        resourceId: null,
      })),
    );
    return out;
  }

  // ── visits ─────────────────────────────────────────────────────────

  private visitsBase(scope: VisibleScope, profileId?: string) {
    const qb = this.qb()
      .from('patient_encounters', 'e')
      .innerJoin('locations', 'l', 'l.id = e.location_id')
      .leftJoin('appointments', 'ap', 'ap.id = e.appointment_id')
      .innerJoin(
        'queue_entries',
        'qe',
        `qe.id = e.queue_entry_id AND qe.status = 'completed'`,
      )
      .leftJoin('queue_sessions', 'qs', 'qs.id = qe.queue_session_id')
      .leftJoin(
        'employees',
        'd',
        'd.id = COALESCE(ap.doctor_id, qs.doctor_id)',
      );
    linkedPatientWhere(qb, scope.ctx, { alias: 'e', profileId });
    return qb;
  }

  async visits(
    ctx: PatientContext,
    q: { profileId?: string; page?: number; limit?: number },
  ): Promise<PagedDto<PatientVisitDto>> {
    const scope = await this.scope(ctx, q.profileId);
    const { page, limit, offset } = this.page(q.page, q.limit);

    const total = Number(
      (
        await this.visitsBase(scope, q.profileId)
          .select('COUNT(*)', 'n')
          .getRawOne<{ n: string }>()
      )?.n ?? 0,
    );
    const rows = await this.visitsBase(scope, q.profileId)
      .select([
        'e.id AS "id"',
        'e.organization_id AS "organizationId"',
        'e.patient_id AS "patientId"',
        `to_char(e.encounter_date AT TIME ZONE l.timezone, 'YYYY-MM-DD') AS "visitDate"`,
        'e.follow_up_date::text AS "followUpDate"',
        'e.diagnosis AS "diagnosis"',
        `(SELECT COALESCE(json_agg(t.treatment_name ORDER BY t.date), '[]'::json)
            FROM treatments t
           WHERE t.encounter_id = e.id AND t.organization_id = e.organization_id) AS "treatments"`,
        'd.full_name AS "doctorName"',
        ...LOCATION_COLUMNS,
      ])
      .orderBy('e.encounter_date', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany<VisitRow & Scoped>();

    const profileOf = this.profileLookup(scope.ctx, q.profileId);
    const data = rows.flatMap((r) => {
      const info = scope.clinics.get(r.organizationId);
      const profileId = profileOf(r);
      return info && profileId
        ? [mapVisit(r, profileId, info.ref, info.showDiagnosis)]
        : [];
    });
    await this.accessLog.record(
      ctx.accountId,
      rows.map((r) => ({
        profileId: profileOf(r) ?? null,
        organizationId: r.organizationId,
        patientId: r.patientId,
        action: 'view_list',
        resourceType: 'visit',
        resourceId: null,
      })),
    );
    return this.paged(data, total, page, limit);
  }

  // ── prescriptions ──────────────────────────────────────────────────

  private prescriptionsBase(scope: VisibleScope, profileId?: string) {
    const qb = this.qb()
      .from('prescriptions', 'p')
      .innerJoin('locations', 'l', 'l.id = p.location_id')
      .leftJoin('employees', 'd', 'd.id = p.doctor_id')
      .andWhere('p.status IN (:...visibleStatuses)', {
        visibleStatuses: [...PRESCRIPTION_VISIBLE_STATUSES],
      })
      .andWhere('p.signed_at IS NOT NULL');
    linkedPatientWhere(qb, scope.ctx, { alias: 'p', profileId });
    return qb;
  }

  private static readonly PRESCRIPTION_COLUMNS = [
    'p.id AS "id"',
    'p.organization_id AS "organizationId"',
    'p.patient_id AS "patientId"',
    'p.prescription_number AS "number"',
    'p.signed_at AS "signedAt"',
    '(SELECT COUNT(*) FROM prescription_medicines m WHERE m.prescription_id = p.id) AS "medicinesCount"',
    'd.full_name AS "doctorName"',
    ...LOCATION_COLUMNS,
  ];

  async prescriptions(
    ctx: PatientContext,
    q: { profileId?: string; page?: number; limit?: number },
  ): Promise<PagedDto<PatientPrescriptionDto>> {
    const scope = await this.scope(ctx, q.profileId);
    const { page, limit, offset } = this.page(q.page, q.limit);

    const total = Number(
      (
        await this.prescriptionsBase(scope, q.profileId)
          .select('COUNT(*)', 'n')
          .getRawOne<{ n: string }>()
      )?.n ?? 0,
    );
    const rows = await this.prescriptionsBase(scope, q.profileId)
      .select(PatientReadsService.PRESCRIPTION_COLUMNS)
      .orderBy('p.signed_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany<PrescriptionRow & Scoped>();

    const profileOf = this.profileLookup(scope.ctx, q.profileId);
    const data = rows.flatMap((r) => {
      const profileId = profileOf(r);
      const info = scope.clinics.get(r.organizationId);
      return info && profileId
        ? [mapPrescription(r, profileId, info.ref, info.showDiagnosis)]
        : [];
    });
    await this.accessLog.record(
      ctx.accountId,
      rows.map((r) => ({
        profileId: profileOf(r) ?? null,
        organizationId: r.organizationId,
        patientId: r.patientId,
        action: 'view_list',
        resourceType: 'prescription',
        resourceId: null,
      })),
    );
    return this.paged(data, total, page, limit);
  }

  /** The scoped lookup shared by the detail and PDF endpoints. */
  private async findPrescription(ctx: PatientContext, id: string) {
    if (!UUID_RE.test(id)) throw notFound();
    const scope = await this.clinics.visibleScope(ctx);
    const row = await this.prescriptionsBase(scope)
      .select(PatientReadsService.PRESCRIPTION_COLUMNS)
      .andWhere('p.id = :id', { id })
      .getRawOne<PrescriptionRow & Scoped>();
    const profileId = row ? this.profileLookup(scope.ctx)(row) : undefined;
    const info = row ? scope.clinics.get(row.organizationId) : undefined;
    if (!row || !profileId || !info) throw notFound();
    return { row, profileId, info };
  }

  async prescription(
    ctx: PatientContext,
    id: string,
  ): Promise<PatientPrescriptionDetailDto> {
    const { row, profileId, info } = await this.findPrescription(ctx, id);

    const medicines = await this.qb()
      .select([
        'm.medicine_name AS "medicineName"',
        'm.medicine_name_urdu AS "medicineNameUrdu"',
        'm.type AS "type"',
        'm.dosage AS "dosage"',
        'm.frequency AS "frequency"',
        'm.frequency_timing AS "frequencyTiming"',
        'm.meal_relation AS "mealRelation"',
        'm.duration AS "duration"',
        'm.special_instructions AS "specialInstructions"',
        'm.special_instructions_urdu AS "specialInstructionsUrdu"',
      ])
      .from('prescription_medicines', 'm')
      .where('m.prescription_id = :id', { id })
      .orderBy('m.sort_order', 'ASC')
      .getRawMany<MedicineRow>();

    await this.accessLog.record(ctx.accountId, [
      {
        profileId,
        organizationId: row.organizationId,
        patientId: row.patientId,
        action: 'view_detail',
        resourceType: 'prescription',
        resourceId: id,
      },
    ]);
    return mapPrescriptionDetail(
      row,
      medicines,
      profileId,
      info.ref,
      info.showDiagnosis,
    );
  }

  /**
   * The prescription PDF prints diagnosis, complaint and vitals, so it is
   * only served when the clinic shows diagnosis to patients. The stored
   * public file URL is never exposed: the PDF is rendered per request and
   * streamed through the API (no reusable link).
   */
  async prescriptionPdf(
    ctx: PatientContext,
    id: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const { row, profileId, info } = await this.findPrescription(ctx, id);
    if (!canSeeDiagnosis(info)) throw notFound();
    const buffer = await this.pdfs.generatePdfBuffer(id, row.organizationId);
    await this.accessLog.record(ctx.accountId, [
      {
        profileId,
        organizationId: row.organizationId,
        patientId: row.patientId,
        action: 'download',
        resourceType: 'prescription',
        resourceId: id,
      },
    ]);
    return {
      buffer,
      fileName: `prescription-${row.number.replace(/[^A-Za-z0-9_-]/g, '')}.pdf`,
    };
  }

  // ── billing ────────────────────────────────────────────────────────

  async billingSummary(
    ctx: PatientContext,
    q: { profileId?: string },
  ): Promise<PatientBillingClinicDto[]> {
    const full = await this.scope(ctx, q.profileId);
    const scope = this.clinics.narrow(full, canSeeBilling);
    if (scope.clinics.size === 0) return [];

    const profileOf = this.profileLookup(scope.ctx, q.profileId);
    const logged: (Scoped & { id: string })[] = [];
    const perClinic = await Promise.all(
      [...scope.clinics].map(async ([orgId, info]) => {
        const one = {
          ...scope.ctx,
          links: scope.ctx.links.filter((l) => l.organizationId === orgId),
        };
        const base = () => {
          const qb = this.qb()
            .from('invoices', 'i')
            .innerJoin('locations', 'l', 'l.id = i.location_id')
            .andWhere(`i.status = 'ISSUED'`);
          linkedPatientWhere(qb, one, { alias: 'i', profileId: q.profileId });
          return qb;
        };
        const totals = await base()
          .select([
            'COUNT(*) AS "n"',
            'COALESCE(SUM(i.total_amount), 0) AS "total"',
            'COALESCE(SUM(i.paid_amount), 0) AS "paid"',
            'COALESCE(SUM(i.balance_due), 0) AS "balance"',
          ])
          .getRawOne<{
            n: string;
            total: string;
            paid: string;
            balance: string;
          }>();
        if (!totals || Number(totals.n) === 0) return null;
        const rows = (
          await base()
            .select([
              'i.id AS "id"',
              'i.organization_id AS "organizationId"',
              'i.patient_id AS "patientId"',
              'i.invoice_number AS "invoiceNumber"',
              'i.issued_at AS "issuedAt"',
              'i.due_date::text AS "dueDate"',
              'i.total_amount AS "totalAmount"',
              'i.paid_amount AS "paidAmount"',
              'i.balance_due AS "balanceDue"',
              'l.timezone AS "locationTimezone"',
            ])
            .orderBy('i.issued_at', 'DESC')
            .addOrderBy('i.id', 'DESC')
            .limit(MAX_INVOICES_PER_CLINIC)
            .getRawMany<InvoiceRow & Scoped>()
        ).filter((r) => r.organizationId === orgId);
        logged.push(...rows);
        const dto: PatientBillingClinicDto = {
          clinic: info.ref,
          currency: info.currency,
          billedMinor: toMinor(totals.total),
          paidMinor: toMinor(totals.paid),
          balanceMinor: toMinor(totals.balance),
          invoices: rows.flatMap((r) => {
            const profileId = profileOf(r);
            // overdue is judged on the invoice location clock
            return profileId
              ? [mapInvoice(r, profileId, this.clock.today(r.locationTimezone))]
              : [];
          }),
        };
        return dto;
      }),
    );
    const out = perClinic.filter(
      (c): c is PatientBillingClinicDto => c !== null,
    );
    out.sort((a, b) => a.clinic.name.localeCompare(b.clinic.name));

    await this.accessLog.record(
      ctx.accountId,
      logged.map((r) => ({
        profileId: profileOf(r) ?? null,
        organizationId: r.organizationId,
        patientId: r.patientId,
        action: 'view_list',
        resourceType: 'invoice',
        resourceId: null,
      })),
    );
    return out;
  }
}
