import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  EntityTarget,
  Not,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { AppLogger } from 'src/common/services/logger.service';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { AuditService, TimelineEntry } from 'src/common/audit/audit.service';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { sqlRows } from 'src/common/database/sql';
import type { AccessContext } from 'src/access/access-context';
import { patientScope } from './access/patient-scope';
import {
  PATIENT_AUDIT_ENTITY,
  PatientAuditEntity,
  patientRecordSnapshot,
  recordPatientChange,
  redactPatientTimeline,
} from './patient-audit';

// Entities
import { Patient } from './entities/patient.entity';
import { PatientVisit } from './entities/patient-visit.entity';
import { PatientDentalInfo } from './entities/patient-dental-info.entity';
import { PatientTeethChart } from './entities/patient-teeth-chart.entity';
import { PatientVitals } from './entities/patient-vitals.entity';
import { PatientPrescription } from './entities/patient-prescription.entity';
import { PatientDocument } from './entities/patient-document.entity';
import { PatientConsent } from './entities/patient-consent.entity';
import { PatientCommunication } from './entities/patient-communication.entity';
import { PatientRecall } from './entities/patient-recall.entity';
import { PatientReferral } from './entities/patient-referral.entity';
import { PatientFeedback } from './entities/patient-feedback.entity';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { EncountersService } from 'src/encounters/encounters.service';
import { TreatmentsService } from 'src/treatments/treatments.service';

// DTOs
import { CreatePatientDto } from './dto/request/create-patient.dto';
import { UpdatePatientDto } from './dto/request/update-patient.dto';
import {
  PatientQueryDto,
  PatientSortBy,
  SortOrder,
} from './dto/request/patient-query.dto';
import { PatientResponseDto } from './dto/response/patient-response.dto';
import {
  UpsertDentalInfoDto,
  CreateTeethChartDto,
  CreateVitalsDto,
  CreatePrescriptionDto,
  CreateDocumentDto,
  CreateConsentDto,
  CreateCommunicationDto,
  CreateRecallDto,
  UpdateRecallDto,
  CreateReferralDto,
  CreateFeedbackDto,
  CreateInsuranceDto,
  UpdateInsuranceDto,
} from './dto/request/sub-entity.dto';

/** Most rows one patient export returns. */
export const EXPORT_MAX_ROWS = 10000;

/** One CSV cell: quoted when needed; formula-leading values neutralised. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // `+923…` phones and `-5` numbers stay as they are; anything else that a
  // spreadsheet would run as a formula gets a leading quote.
  const plainNumber = /^[+-][\d\s().-]+$/.test(text);
  if (/^[=+\-@\t\r]/.test(text) && !plainNumber) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(PatientVisit)
    private readonly visitRepo: Repository<PatientVisit>,
    @InjectRepository(PatientDentalInfo)
    private readonly dentalInfoRepo: Repository<PatientDentalInfo>,
    @InjectRepository(PatientTeethChart)
    private readonly teethChartRepo: Repository<PatientTeethChart>,
    @InjectRepository(PatientVitals)
    private readonly vitalsRepo: Repository<PatientVitals>,
    @InjectRepository(PatientPrescription)
    private readonly prescriptionRepo: Repository<PatientPrescription>,
    @InjectRepository(PatientDocument)
    private readonly documentRepo: Repository<PatientDocument>,
    @InjectRepository(PatientConsent)
    private readonly consentRepo: Repository<PatientConsent>,
    @InjectRepository(PatientCommunication)
    private readonly communicationRepo: Repository<PatientCommunication>,
    @InjectRepository(PatientRecall)
    private readonly recallRepo: Repository<PatientRecall>,
    @InjectRepository(PatientReferral)
    private readonly referralRepo: Repository<PatientReferral>,
    @InjectRepository(PatientFeedback)
    private readonly feedbackRepo: Repository<PatientFeedback>,
    @InjectRepository(PatientInsurance)
    private readonly insuranceRepo: Repository<PatientInsurance>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly encountersService: EncountersService,
    private readonly treatmentsService: TreatmentsService,
    private readonly logger: AppLogger,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Saves one patient record and its audit row in one transaction. Pass the
   * snapshot taken before an edit as `before`; omit it for a new record.
   */
  private saveAudited<T extends ObjectLiteral & { id: string }>(
    actor: ActorRef,
    target: EntityTarget<T>,
    row: T,
    audit: {
      organizationId: string;
      patientId: string;
      entityType: PatientAuditEntity;
      before?: Record<string, unknown>;
    },
  ): Promise<T> {
    return this.dataSource.transaction(async (m) => {
      const saved = await m.getRepository(target).save(row);
      await recordPatientChange(this.audit, m, actor, {
        organizationId: audit.organizationId,
        patientId: audit.patientId,
        entityType: audit.entityType,
        entityId: saved.id,
        before: audit.before ?? null,
        after: patientRecordSnapshot(m, target, saved),
      });
      return saved;
    });
  }

  private snapshot<T extends ObjectLiteral>(target: EntityTarget<T>, row: T) {
    return patientRecordSnapshot(this.dataSource.manager, target, row);
  }

  private async generatePatientNumber(organizationId: string): Promise<string> {
    const count = await this.patientRepo.count({
      where: { organizationId },
      withDeleted: true,
    });
    return `P-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateRxNumber(organizationId: string): Promise<string> {
    const count = await this.prescriptionRepo.count({
      where: { organizationId },
    });
    return `RX-${String(count + 1).padStart(5, '0')}`;
  }

  private async validatePhoneUnique(
    organizationId: string,
    phone: string,
    excludeId?: string,
  ): Promise<void> {
    const where: any = { organizationId, phone };
    if (excludeId) where.id = Not(excludeId);
    const existing = await this.patientRepo.findOne({ where });
    if (existing) {
      throw new ConflictException(
        'A patient with this phone number already exists in this organization',
      );
    }
  }

  private async getPatientOrFail(
    id: string,
    organizationId: string,
  ): Promise<Patient> {
    const patient = await this.patientRepo.findOne({
      where: { id, organizationId },
    });
    if (!patient) throw new NotFoundException(`Patient not found`);
    return patient;
  }

  // ═══════════════════════════════════════════════════════════
  // PATIENT CRUD
  // ═══════════════════════════════════════════════════════════

  async create(
    ctx: TenantContext,
    dto: CreatePatientDto,
    actor: ActorRef,
  ): Promise<PatientResponseDto> {
    const { organizationId, locationId } = ctx;
    this.logger.info(`Creating patient: ${dto.fullName}`, PatientsService.name);

    await this.validatePhoneUnique(organizationId, dto.phone);

    const patientNumber = await this.generatePatientNumber(organizationId);

    const { dob, ...rest } = dto;
    const patient = this.patientRepo.create({
      ...rest,
      organizationId,
      patientNumber,
      primaryLocationId: dto.primaryLocationId || locationId,
      dob: dob ? new Date(dob) : null,
      createdBy: actor.userId,
    });

    const saved = await this.dataSource.transaction(async (m) => {
      const row = await m.getRepository(Patient).save(patient);
      await recordPatientChange(this.audit, m, actor, {
        organizationId,
        patientId: row.id,
        entityType: PATIENT_AUDIT_ENTITY.PATIENT,
        entityId: row.id,
        before: null,
        after: patientRecordSnapshot(m, Patient, row),
      });
      return row;
    });
    this.logger.info(
      `Patient created: ${saved.patientNumber}`,
      PatientsService.name,
    );
    return PatientResponseDto.toDto(saved);
  }

  /** Patients list / search, limited to the caller's `patients.view` scope. */
  async findAll(
    organizationId: string,
    query: PatientQueryDto,
    access: AccessContext,
  ): Promise<PaginatedResponseDto<PatientResponseDto>> {
    const { page = 1, limit = 10 } = query;
    const qb = this.listQuery(organizationId, query, access);
    qb.skip((page - 1) * limit).take(limit);

    const [patients, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(
      PatientResponseDto.toDtoList(patients),
      total,
      page,
      limit,
    );
  }

  /**
   * The patient list as CSV: same filters, sort and `patients.view` scope as
   * `findAll`, without paging (capped at EXPORT_MAX_ROWS).
   */
  async exportCsv(
    organizationId: string,
    query: PatientQueryDto,
    access: AccessContext,
  ): Promise<{ csv: string; rows: number; truncated: boolean }> {
    const patients = await this.listQuery(organizationId, query, access)
      .take(EXPORT_MAX_ROWS + 1)
      .getMany();
    const truncated = patients.length > EXPORT_MAX_ROWS;
    const rows = patients.slice(0, EXPORT_MAX_ROWS);
    const header = [
      'Patient number',
      'Name',
      'Phone',
      'Email',
      'Gender',
      'Date of birth',
      'Blood group',
      'City',
      'Source',
      'Active',
      'Registered on',
    ];
    const lines = rows.map((p) =>
      [
        p.patientNumber,
        p.fullName,
        p.phone,
        p.email,
        p.gender,
        p.dob ? new Date(p.dob).toISOString().slice(0, 10) : '',
        p.bloodGroup,
        p.city,
        p.source,
        p.isActive ? 'yes' : 'no',
        p.createdAt.toISOString().slice(0, 10),
      ]
        .map(csvCell)
        .join(','),
    );
    // BOM so Excel opens UTF-8 (Urdu names) correctly.
    const csv = '\uFEFF' + [header.join(','), ...lines].join('\r\n');
    return { csv, rows: rows.length, truncated };
  }

  /** Filtered, sorted, scope-limited patient query shared by list and export. */
  private listQuery(
    organizationId: string,
    query: PatientQueryDto,
    access: AccessContext,
  ) {
    const {
      search,
      gender,
      bloodGroup,
      source,
      city,
      tag,
      isActive,
      isBlacklisted,
      isMinor,
      sortBy = PatientSortBy.CREATED_AT,
      sortOrder = SortOrder.DESC,
    } = query;

    const qb = this.patientRepo
      .createQueryBuilder('p')
      .where('p.organization_id = :organizationId', { organizationId });
    access.applyScope(qb, 'patients.view', patientScope('p.id'));

    if (search?.trim()) {
      qb.andWhere(
        '(p.full_name ILIKE :s OR p.phone ILIKE :s OR p.patient_number ILIKE :s)',
        { s: `%${search.trim()}%` },
      );
    }
    if (gender) qb.andWhere('p.gender = :gender', { gender });
    if (bloodGroup) qb.andWhere('p.blood_group = :bloodGroup', { bloodGroup });
    if (source) qb.andWhere('p.source = :source', { source });
    if (city) qb.andWhere('p.city ILIKE :city', { city: `%${city}%` });
    if (tag) qb.andWhere('p.tags @> :tag', { tag: JSON.stringify([tag]) });
    if (isActive !== undefined)
      qb.andWhere('p.is_active = :isActive', { isActive });
    if (isBlacklisted !== undefined)
      qb.andWhere('p.is_blacklisted = :isBlacklisted', { isBlacklisted });
    if (isMinor !== undefined)
      qb.andWhere('p.is_minor = :isMinor', { isMinor });

    const sortMap: Record<string, string> = {
      createdAt: 'p.created_at',
      fullName: 'p.full_name',
      patientNumber: 'p.patient_number',
    };
    qb.orderBy(sortMap[sortBy] || 'p.created_at', sortOrder);
    return qb;
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<PatientResponseDto> {
    const patient = await this.getPatientOrFail(id, organizationId);
    return PatientResponseDto.toDto(patient);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdatePatientDto,
    actor: ActorRef,
  ): Promise<PatientResponseDto> {
    const patient = await this.getPatientOrFail(id, organizationId);

    if (dto.phone && dto.phone !== patient.phone) {
      await this.validatePhoneUnique(organizationId, dto.phone, id);
    }

    const { dob, ...rest } = dto;
    const updateData: Partial<Patient> = { ...rest };
    if (dob !== undefined) updateData.dob = dob ? new Date(dob) : null;

    const before = this.snapshot(Patient, patient);
    Object.assign(patient, updateData);
    const saved = await this.saveAudited(actor, Patient, patient, {
      organizationId,
      patientId: id,
      entityType: PATIENT_AUDIT_ENTITY.PATIENT,
      before,
    });
    return PatientResponseDto.toDto(saved);
  }

  async setActive(
    id: string,
    organizationId: string,
    isActive: boolean,
    actor: ActorRef,
  ): Promise<PatientResponseDto> {
    const patient = await this.getPatientOrFail(id, organizationId);
    if (patient.isActive === isActive) return PatientResponseDto.toDto(patient);
    const state = (active: boolean) => (active ? 'active' : 'inactive');
    const fromState = state(patient.isActive);
    patient.isActive = isActive;
    const saved = await this.dataSource.transaction(async (m) => {
      const row = await m.getRepository(Patient).save(patient);
      await this.audit.recordStatus(m, actor, {
        organizationId,
        entityType: PATIENT_AUDIT_ENTITY.PATIENT,
        entityId: id,
        subjectId: id,
        fromState,
        toState: state(isActive),
        actionCode: isActive ? 'activate' : 'deactivate',
      });
      return row;
    });
    return PatientResponseDto.toDto(saved);
  }

  /**
   * Permanently deletes the patient. All patient-owned rows (appointments,
   * invoices, payments, prescriptions, clinical records) are removed by the
   * database via ON DELETE CASCADE. Use `setActive(false)` to hide a patient
   * without losing data. The audit row keeps the patient's last state and how
   * many linked records went with them.
   */
  async remove(
    id: string,
    organizationId: string,
    actor: ActorRef,
  ): Promise<void> {
    const patient = await this.getPatientOrFail(id, organizationId);
    await this.dataSource.transaction(async (m) => {
      const linkedRecords = await this.cascadeCounts(m, id);
      await recordPatientChange(this.audit, m, actor, {
        organizationId,
        patientId: id,
        entityType: PATIENT_AUDIT_ENTITY.PATIENT,
        entityId: id,
        before: {
          ...patientRecordSnapshot(m, Patient, patient),
          linkedRecords,
        },
        after: null,
      });
      await m.getRepository(Patient).delete({ id, organizationId });
    });
  }

  /**
   * Rows of every table that `ON DELETE CASCADE`s from `patients`, counted
   * for one patient (non-zero only) — read from the catalog, so new tables
   * are covered without a list to maintain.
   */
  private async cascadeCounts(
    m: EntityManager,
    patientId: string,
  ): Promise<Record<string, number>> {
    const fks = await sqlRows<{ tbl: string; col: string }>(
      m,
      `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
         FROM pg_constraint c
         JOIN pg_attribute a
           ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confdeltype = 'c'
          AND c.confrelid = 'patients'::regclass
          AND array_length(c.conkey, 1) = 1
        ORDER BY 1, 2`,
    );
    if (!fks.length) return {};
    // Identifiers come from the catalog: regclass text is already quoted.
    const union = fks
      .map(
        ({ tbl, col }) =>
          `SELECT '${tbl.replace(/'/g, "''")}' AS tbl, count(*)::int AS n
             FROM ${tbl} WHERE "${col.replace(/"/g, '""')}" = $1`,
      )
      .join(' UNION ALL ');
    const rows = await sqlRows<{ tbl: string; n: number }>(m, union, [
      patientId,
    ]);
    const counts: Record<string, number> = {};
    for (const { tbl, n } of rows) {
      if (n > 0) counts[tbl] = (counts[tbl] ?? 0) + n;
    }
    return counts;
  }

  async checkPhoneExists(
    organizationId: string,
    phone: string,
    excludeId?: string,
  ): Promise<{ exists: boolean }> {
    const where: any = { organizationId, phone };
    if (excludeId) where.id = Not(excludeId);
    const existing = await this.patientRepo.findOne({ where });
    return { exists: !!existing };
  }

  // ═══════════════════════════════════════════════════════════
  // DENTAL INFO (1:1 — upsert)
  // ═══════════════════════════════════════════════════════════

  async getDentalInfo(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.dentalInfoRepo.findOne({
      where: { patientId, organizationId },
    });
  }

  async upsertDentalInfo(
    patientId: string,
    ctx: TenantContext,
    dto: UpsertDentalInfoDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    let info = await this.dentalInfoRepo.findOne({
      where: { patientId, organizationId: ctx.organizationId },
    });

    const before = info ? this.snapshot(PatientDentalInfo, info) : undefined;
    if (info) {
      Object.assign(info, dto);
    } else {
      info = this.dentalInfoRepo.create({
        ...dto,
        patientId,
        organizationId: ctx.organizationId,
      });
    }
    return this.saveAudited(actor, PatientDentalInfo, info, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.DENTAL_INFO,
      before,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // TEETH CHARTS (append-only)
  // ═══════════════════════════════════════════════════════════

  async getTeethCharts(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.teethChartRepo.find({
      where: { patientId, organizationId },
      order: { recordedAt: 'DESC' },
    });
  }

  async createTeethChart(
    patientId: string,
    ctx: TenantContext,
    dto: CreateTeethChartDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);

    // Check if this is the first chart
    const existingCount = await this.teethChartRepo.count({
      where: { patientId, organizationId: ctx.organizationId },
    });

    const chart = this.teethChartRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      isInitialChart: dto.isInitialChart ?? existingCount === 0,
    });
    return this.saveAudited(actor, PatientTeethChart, chart, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.TEETH_CHART,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // VITALS
  // ═══════════════════════════════════════════════════════════

  async getVitals(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.vitalsRepo.find({
      where: { patientId, organizationId },
      order: { recordedAt: 'DESC' },
    });
  }

  async createVitals(
    patientId: string,
    ctx: TenantContext,
    dto: CreateVitalsDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);

    // Auto-compute BMI
    let bmi: number | null = null;
    if (dto.weightKg && dto.heightCm && dto.heightCm > 0) {
      const heightM = dto.heightCm / 100;
      bmi = parseFloat((dto.weightKg / (heightM * heightM)).toFixed(2));
    }

    const vitals = this.vitalsRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      bmi,
    });
    return this.saveAudited(actor, PatientVitals, vitals, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.VITALS,
    });
  }
  // ═══════════════════════════════════════════════════════════
  // PRESCRIPTIONS
  // ═══════════════════════════════════════════════════════════

  async getPrescriptions(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.prescriptionRepo.find({
      where: { patientId, organizationId },
      order: { prescriptionDate: 'DESC' },
    });
  }

  async createPrescription(
    patientId: string,
    ctx: TenantContext,
    dto: CreatePrescriptionDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const prescriptionNumber = await this.generateRxNumber(ctx.organizationId);

    const rx = this.prescriptionRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      prescriptionNumber,
      followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
    });
    return this.saveAudited(actor, PatientPrescription, rx, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.PRESCRIPTION,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════════

  async getDocuments(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.documentRepo.find({
      where: { patientId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createDocument(
    patientId: string,
    ctx: TenantContext,
    dto: CreateDocumentDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const doc = this.documentRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      takenDate: dto.takenDate ? new Date(dto.takenDate) : null,
    });
    return this.saveAudited(actor, PatientDocument, doc, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.DOCUMENT,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CONSENTS (Immutable — POST + GET only)
  // ═══════════════════════════════════════════════════════════

  async getConsents(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.consentRepo.find({
      where: { patientId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createConsent(
    patientId: string,
    ctx: TenantContext,
    dto: CreateConsentDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const consent = this.consentRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
    });
    return this.saveAudited(actor, PatientConsent, consent, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.CONSENT,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // COMMUNICATIONS
  // ═══════════════════════════════════════════════════════════

  async getCommunications(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.communicationRepo.find({
      where: { patientId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createCommunication(
    patientId: string,
    ctx: TenantContext,
    dto: CreateCommunicationDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const comm = this.communicationRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
    });
    return this.saveAudited(actor, PatientCommunication, comm, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.COMMUNICATION,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // RECALLS
  // ═══════════════════════════════════════════════════════════

  async getRecalls(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.recallRepo.find({
      where: { patientId, organizationId },
      order: { dueDate: 'ASC' },
    });
  }

  async createRecall(
    patientId: string,
    ctx: TenantContext,
    dto: CreateRecallDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const recall = this.recallRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      dueDate: new Date(dto.dueDate),
      createdBy: actor.userId,
    });
    return this.saveAudited(actor, PatientRecall, recall, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.RECALL,
    });
  }

  async updateRecall(
    patientId: string,
    recallId: string,
    organizationId: string,
    dto: UpdateRecallDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const recall = await this.recallRepo.findOne({
      where: { id: recallId, patientId, organizationId },
    });
    if (!recall) throw new NotFoundException('Recall not found');
    const before = this.snapshot(PatientRecall, recall);
    Object.assign(recall, dto);
    return this.saveAudited(actor, PatientRecall, recall, {
      organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.RECALL,
      before,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // REFERRALS
  // ═══════════════════════════════════════════════════════════

  async getReferrals(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.referralRepo.find({
      where: { referringPatientId: patientId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createReferral(
    patientId: string,
    organizationId: string,
    dto: CreateReferralDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const referral = this.referralRepo.create({
      ...dto,
      referringPatientId: patientId,
      organizationId,
    });
    return this.saveAudited(actor, PatientReferral, referral, {
      organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.REFERRAL,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════

  async getFeedback(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.feedbackRepo.find({
      where: { patientId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createFeedback(
    patientId: string,
    ctx: TenantContext,
    dto: CreateFeedbackDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const feedback = this.feedbackRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
    });
    return this.saveAudited(actor, PatientFeedback, feedback, {
      organizationId: ctx.organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.FEEDBACK,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // INSURANCE
  // ═══════════════════════════════════════════════════════════

  async getInsurance(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.insuranceRepo.find({
      where: { patientId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createInsurance(
    patientId: string,
    organizationId: string,
    dto: CreateInsuranceDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const insurance = this.insuranceRepo.create({
      ...dto,
      patientId,
      organizationId,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    });
    return this.saveAudited(actor, PatientInsurance, insurance, {
      organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.INSURANCE,
    });
  }

  async updateInsurance(
    patientId: string,
    insuranceId: string,
    organizationId: string,
    dto: UpdateInsuranceDto,
    actor: ActorRef,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const insurance = await this.insuranceRepo.findOne({
      where: { id: insuranceId, patientId, organizationId },
    });
    if (!insurance) throw new NotFoundException('Insurance record not found');
    const before = this.snapshot(PatientInsurance, insurance);
    Object.assign(insurance, dto);
    return this.saveAudited(actor, PatientInsurance, insurance, {
      organizationId,
      patientId,
      entityType: PATIENT_AUDIT_ENTITY.INSURANCE,
      before,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PATIENT VISITS
  // ═══════════════════════════════════════════════════════════

  async getVisits(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.visitRepo.find({
      where: { patientId, organizationId },
      order: { lastVisitDate: 'DESC' },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // AUDIT TRAIL
  // ═══════════════════════════════════════════════════════════

  /**
   * Who changed what on this patient and their records, newest first. Values
   * of records the reader cannot open are left out (see `redactPatientTimeline`).
   */
  async getAuditTrail(
    patientId: string,
    organizationId: string,
    access: AccessContext,
  ): Promise<TimelineEntry[]> {
    await this.getPatientOrFail(patientId, organizationId);
    const entries = await this.audit.subjectTimeline(
      this.dataSource.manager,
      patientId,
      organizationId,
    );
    return redactPatientTimeline(entries, access);
  }

  // ═══════════════════════════════════════════════════════════
  // FULL HISTORY (Flow G)
  // ═══════════════════════════════════════════════════════════

  /**
   * Aggregate clinical history: the patient, all appointments, all encounters
   * (each with its linked treatments), and any treatments not tied to an
   * encounter — shown separately as "standalone treatments". All date-desc.
   */
  async getHistory(patientId: string, ctx: TenantContext) {
    const patient = await this.getPatientOrFail(patientId, ctx.organizationId);

    const appointments = await this.appointmentRepo.find({
      where: { patientId, organizationId: ctx.organizationId },
      order: { startTime: 'DESC' },
    });

    const encounters = await this.encountersService.findByPatient(
      patientId,
      ctx,
    );

    const allTreatments = await this.treatmentsService.findByPatient(
      patientId,
      ctx,
    );
    const standaloneTreatments = allTreatments.filter(
      (t) => t.encounterId === null,
    );

    return {
      patient: PatientResponseDto.toDto(patient),
      appointments,
      encounters,
      standaloneTreatments,
    };
  }
}
