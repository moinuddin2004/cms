import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { AppLogger } from 'src/common/services/logger.service';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { AccessContext } from 'src/access/access-context';
import { patientScope } from './access/patient-scope';

// Entities
import { Patient } from './entities/patient.entity';
import { PatientVisit } from './entities/patient-visit.entity';
import { PatientDentalInfo } from './entities/patient-dental-info.entity';
import { PatientTeethChart } from './entities/patient-teeth-chart.entity';
import { PatientVitals } from './entities/patient-vitals.entity';
import { PatientTreatmentPlan } from './entities/patient-treatment-plan.entity';
import { TreatmentPlanItem } from './entities/treatment-plan-item.entity';
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
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanDto,
  CreatePlanItemDto,
  UpdatePlanItemDto,
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
    @InjectRepository(PatientTreatmentPlan)
    private readonly treatmentPlanRepo: Repository<PatientTreatmentPlan>,
    @InjectRepository(TreatmentPlanItem)
    private readonly planItemRepo: Repository<TreatmentPlanItem>,
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
  ) {}

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private async generatePatientNumber(organizationId: string): Promise<string> {
    const count = await this.patientRepo.count({
      where: { organizationId },
      withDeleted: true,
    });
    return `P-${String(count + 1).padStart(5, '0')}`;
  }

  private async generatePlanNumber(organizationId: string): Promise<string> {
    const count = await this.treatmentPlanRepo.count({
      where: { organizationId },
      withDeleted: true,
    });
    return `TP-${String(count + 1).padStart(5, '0')}`;
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
    userId?: string,
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
      createdBy: userId || null,
    });

    const saved = await this.patientRepo.save(patient);
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
  ): Promise<PatientResponseDto> {
    const patient = await this.getPatientOrFail(id, organizationId);

    if (dto.phone && dto.phone !== patient.phone) {
      await this.validatePhoneUnique(organizationId, dto.phone, id);
    }

    const { dob, ...rest } = dto;
    const updateData: Partial<Patient> = { ...rest };
    if (dob !== undefined) updateData.dob = dob ? new Date(dob) : null;

    Object.assign(patient, updateData);
    const saved = await this.patientRepo.save(patient);
    return PatientResponseDto.toDto(saved);
  }

  async setActive(
    id: string,
    organizationId: string,
    isActive: boolean,
  ): Promise<PatientResponseDto> {
    const patient = await this.getPatientOrFail(id, organizationId);
    patient.isActive = isActive;
    const saved = await this.patientRepo.save(patient);
    return PatientResponseDto.toDto(saved);
  }

  /**
   * Permanently deletes the patient. All patient-owned rows (appointments,
   * invoices, payments, prescriptions, clinical records) are removed by the
   * database via ON DELETE CASCADE. Use `setActive(false)` to hide a patient
   * without losing data.
   */
  async remove(id: string, organizationId: string): Promise<void> {
    await this.getPatientOrFail(id, organizationId);
    await this.patientRepo.delete({ id, organizationId });
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
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    let info = await this.dentalInfoRepo.findOne({
      where: { patientId, organizationId: ctx.organizationId },
    });

    if (info) {
      Object.assign(info, dto);
    } else {
      info = this.dentalInfoRepo.create({
        ...dto,
        patientId,
        organizationId: ctx.organizationId,
      });
    }
    return this.dentalInfoRepo.save(info);
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
    return this.teethChartRepo.save(chart);
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
    return this.vitalsRepo.save(vitals);
  }

  // ═══════════════════════════════════════════════════════════
  // TREATMENT PLANS
  // ═══════════════════════════════════════════════════════════

  async getTreatmentPlans(patientId: string, organizationId: string) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.treatmentPlanRepo.find({
      where: { patientId, organizationId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async createTreatmentPlan(
    patientId: string,
    ctx: TenantContext,
    dto: CreateTreatmentPlanDto,
    userId?: string,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const planNumber = await this.generatePlanNumber(ctx.organizationId);

    const finalEstimatedCost = dto.estimatedCost
      ? dto.estimatedCost - (dto.discountAmount || 0)
      : null;

    const plan = this.treatmentPlanRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      planNumber,
      finalEstimatedCost,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      expectedEndDate: dto.expectedEndDate
        ? new Date(dto.expectedEndDate)
        : null,
      createdBy: userId || null,
    });
    return this.treatmentPlanRepo.save(plan);
  }

  async updateTreatmentPlan(
    patientId: string,
    planId: string,
    organizationId: string,
    dto: UpdateTreatmentPlanDto,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const plan = await this.treatmentPlanRepo.findOne({
      where: { id: planId, patientId, organizationId },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    if (dto.patientAccepted && !plan.patientAccepted) {
      dto['patientAcceptedAt'] = new Date() as any;
    }

    // Recalculate final cost if either estimatedCost or discount changed
    const estimatedCost = dto.estimatedCost ?? plan.estimatedCost;
    const discountAmount = dto.discountAmount ?? plan.discountAmount;
    if (estimatedCost != null) {
      (dto as any).finalEstimatedCost = estimatedCost - (discountAmount || 0);
    }

    Object.assign(plan, dto);
    return this.treatmentPlanRepo.save(plan);
  }

  // ─── Plan Items ─────────────────────────────────────────

  async getPlanItems(
    patientId: string,
    planId: string,
    organizationId: string,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    return this.planItemRepo.find({
      where: { planId },
      order: { sequenceOrder: 'ASC' },
    });
  }

  async createPlanItem(
    patientId: string,
    planId: string,
    ctx: TenantContext,
    dto: CreatePlanItemDto,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const plan = await this.treatmentPlanRepo.findOne({
      where: { id: planId, patientId, organizationId: ctx.organizationId },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    const item = this.planItemRepo.create({ ...dto, planId });
    return this.planItemRepo.save(item);
  }

  async updatePlanItem(
    patientId: string,
    planId: string,
    itemId: string,
    organizationId: string,
    dto: UpdatePlanItemDto,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const plan = await this.treatmentPlanRepo.findOne({
      where: { id: planId, patientId, organizationId },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    const item = await this.planItemRepo.findOne({
      where: { id: itemId, planId },
    });
    if (!item) throw new NotFoundException('Plan item not found');

    Object.assign(item, dto);
    // Keep completed sessions within bounds of the estimate.
    const estimate = dto.estimatedSessions ?? item.estimatedSessions;
    if (item.completedSessions > estimate) item.completedSessions = estimate;
    return this.planItemRepo.save(item);
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
    return this.prescriptionRepo.save(rx);
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
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const doc = this.documentRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      takenDate: dto.takenDate ? new Date(dto.takenDate) : null,
    });
    return this.documentRepo.save(doc);
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
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const consent = this.consentRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
    });
    return this.consentRepo.save(consent);
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
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const comm = this.communicationRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
    });
    return this.communicationRepo.save(comm);
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
    userId?: string,
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const recall = this.recallRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      dueDate: new Date(dto.dueDate),
      createdBy: userId || null,
    });
    return this.recallRepo.save(recall);
  }

  async updateRecall(
    patientId: string,
    recallId: string,
    organizationId: string,
    dto: UpdateRecallDto,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const recall = await this.recallRepo.findOne({
      where: { id: recallId, patientId, organizationId },
    });
    if (!recall) throw new NotFoundException('Recall not found');
    Object.assign(recall, dto);
    return this.recallRepo.save(recall);
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
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const referral = this.referralRepo.create({
      ...dto,
      referringPatientId: patientId,
      organizationId,
    });
    return this.referralRepo.save(referral);
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
  ) {
    await this.getPatientOrFail(patientId, ctx.organizationId);
    const feedback = this.feedbackRepo.create({
      ...dto,
      patientId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
    });
    return this.feedbackRepo.save(feedback);
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
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const insurance = this.insuranceRepo.create({
      ...dto,
      patientId,
      organizationId,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    });
    return this.insuranceRepo.save(insurance);
  }

  async updateInsurance(
    patientId: string,
    insuranceId: string,
    organizationId: string,
    dto: UpdateInsuranceDto,
  ) {
    await this.getPatientOrFail(patientId, organizationId);
    const insurance = await this.insuranceRepo.findOne({
      where: { id: insuranceId, patientId, organizationId },
    });
    if (!insurance) throw new NotFoundException('Insurance record not found');
    Object.assign(insurance, dto);
    return this.insuranceRepo.save(insurance);
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
