import {
  BadRequestException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionMedicine } from '../entities/prescription-medicine.entity';
import { PrescriptionPreset } from '../entities/prescription-preset.entity';
import { PrescriptionStatus } from '../enums/prescription-status.enum';
import { PrescriptionHistoryChangeType } from '../enums/prescription-history-change-type.enum';
import { MealRelation } from '../enums/meal-relation.enum';
import {
  AddMedicineDto,
  CreatePrescriptionDto,
  FinalizePrescriptionDto,
  PrescriptionFilterDto,
  PrescriptionMedicineDto,
  UpdatePrescriptionDto,
} from '../dto/prescription.dto';
import { PrescriptionTemplateService } from './prescription-template.service';
import { DoctorSignatureService } from './doctor-signature.service';
import { PrescriptionHistoryService } from './prescription-history.service';
import { PrescriptionPdfService } from './prescription-pdf.service';
import type { AccessContext } from 'src/access/access-context';
import { patientScope } from 'src/patients/access/patient-scope';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { ClockService } from 'src/common/clock/clock.service';
import { isYmd } from 'src/common/clock/tz.util';

@Injectable()
export class PrescriptionService {
  constructor(
    @InjectRepository(Prescription)
    private readonly repo: Repository<Prescription>,
    @InjectRepository(PrescriptionMedicine)
    private readonly medicineRepo: Repository<PrescriptionMedicine>,
    @InjectRepository(PrescriptionPreset)
    private readonly presetRepo: Repository<PrescriptionPreset>,
    private readonly templateService: PrescriptionTemplateService,
    private readonly signatureService: DoctorSignatureService,
    private readonly historyService: PrescriptionHistoryService,
    @Inject(forwardRef(() => PrescriptionPdfService))
    private readonly pdfService: PrescriptionPdfService,
    private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════

  async create(
    ctx: TenantContext,
    dto: CreatePrescriptionDto,
    doctorId: string | null,
  ): Promise<Prescription> {
    // 1. If a prescription preset is selected, seed fields + medicines from it
    let seedMedicines: PrescriptionMedicineDto[] = dto.medicines ?? [];
    let seededFurtherPlan = dto.furtherPlan ?? null;
    let seededInstrEn = dto.instructionsEnglish ?? null;
    let seededInstrUr = dto.instructionsUrdu ?? null;

    if (dto.prescriptionPresetId) {
      const tpl = await this.presetRepo.findOne({
        where: {
          id: dto.prescriptionPresetId,
          organizationId: ctx.organizationId,
        },
      });
      if (!tpl) {
        throw new NotFoundException('Prescription preset not found');
      }
      // Only seed fields the caller didn't explicitly set.
      if (!dto.furtherPlan) seededFurtherPlan = tpl.furtherPlan;
      if (!dto.instructionsEnglish) seededInstrEn = tpl.instructionsEnglish;
      if (!dto.instructionsUrdu) seededInstrUr = tpl.instructionsUrdu;
      if (!dto.medicines || dto.medicines.length === 0) {
        seedMedicines = (tpl.medicines ?? []).map((m) => ({
          medicineDirectoryId: m.medicineDirectoryId ?? undefined,
          medicineName: m.medicineName,
          medicineNameUrdu: m.medicineNameUrdu ?? undefined,
          type: m.type ?? undefined,
          dosage: m.dosage,
          frequency: m.frequency,
          frequencyTiming: m.frequencyTiming ?? [],
          mealRelation: m.mealRelation,
          duration: m.duration,
          specialInstructions: m.specialInstructions ?? undefined,
          specialInstructionsUrdu: m.specialInstructionsUrdu ?? undefined,
          sortOrder: m.sortOrder,
        }));
      }
    }

    // 2. Resolve template — explicit, else fall back to location default.
    let prescriptionTemplateId = dto.prescriptionTemplateId ?? null;
    if (!prescriptionTemplateId) {
      const fallback = await this.templateService.getDefaultForLocation(
        ctx.organizationId,
        ctx.locationId,
      );
      prescriptionTemplateId = fallback?.id ?? null;
    }

    // 3. Generate per-org sequential RX number.
    const prescriptionNumber = await this.generatePrescriptionNumber(
      ctx.organizationId,
      ctx.locationId,
    );

    // 4. Save with cascade.
    const prescription = this.repo.create({
      prescriptionNumber,
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      patientId: dto.patientId,
      appointmentId: dto.appointmentId ?? null,
      encounterId: dto.encounterId ?? null,
      doctorId,
      prescriptionTemplateId,
      prescriptionPresetId: dto.prescriptionPresetId ?? null,
      diagnosis: dto.diagnosis ?? null,
      chiefComplaint: dto.chiefComplaint ?? null,
      furtherPlan: seededFurtherPlan,
      instructionsEnglish: seededInstrEn,
      instructionsUrdu: seededInstrUr,
      vitals: dto.vitals ?? null,
      status: PrescriptionStatus.DRAFT,
      version: 1,
      medicines: seedMedicines.map((m, idx) =>
        this.medicineRepo.create({
          ...m,
          mealRelation: m.mealRelation ?? MealRelation.NONE,
          frequencyTiming: m.frequencyTiming ?? [],
          sortOrder: m.sortOrder ?? idx,
        }),
      ),
    });

    const saved = await this.repo.save(prescription);

    await this.historyService.log({
      prescriptionId: saved.id,
      version: saved.version,
      changedBy: doctorId,
      changeType: PrescriptionHistoryChangeType.CREATED,
    });

    return this.findOne(saved.id, ctx.organizationId);
  }

  // ═══════════════════════════════════════════════════════════
  // READ
  // ═══════════════════════════════════════════════════════════

  async findOne(id: string, organizationId: string): Promise<Prescription> {
    const row = await this.repo.findOne({
      where: { id, organizationId },
      relations: [
        'patient',
        'appointment',
        'doctor',
        'prescriptionTemplate',
        'prescriptionPreset',
      ],
    });
    if (!row) throw new NotFoundException('Prescription not found');
    return row;
  }

  /** Prescriptions of patients inside the caller's `patients.view` scope. */
  async findAll(
    ctx: TenantContext,
    filters: PrescriptionFilterDto,
    access: AccessContext,
  ): Promise<{
    data: Prescription[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.patient', 'patient')
      .leftJoinAndSelect('p.doctor', 'doctor')
      .leftJoinAndSelect('p.medicines', 'medicines')
      .where('p.organization_id = :organizationId', {
        organizationId: ctx.organizationId,
      })
      .andWhere('p.location_id = :locationId', { locationId: ctx.locationId });
    access.applyScope(qb, 'patients.view', patientScope('p.patient_id'));

    if (filters.patientId) {
      qb.andWhere('p.patient_id = :patientId', {
        patientId: filters.patientId,
      });
    }
    if (filters.doctorId) {
      qb.andWhere('p.doctor_id = :doctorId', { doctorId: filters.doctorId });
    }
    if (filters.status) {
      qb.andWhere('p.status = :status', { status: filters.status });
    }
    // A bare 'YYYY-MM-DD' is a clinic day: bound it in the location's tz
    // (inclusive of the whole `dateTo` day). Full ISO instants pass through.
    const tz =
      isYmd(filters.dateFrom) || isYmd(filters.dateTo)
        ? await this.clock.timezoneFor(ctx.locationId)
        : 'UTC';
    if (filters.dateFrom) {
      const dateFrom = isYmd(filters.dateFrom)
        ? this.clock.dayRange(tz, filters.dateFrom).start
        : filters.dateFrom;
      qb.andWhere('p.created_at >= :dateFrom', { dateFrom });
    }
    if (filters.dateTo) {
      if (isYmd(filters.dateTo)) {
        qb.andWhere('p.created_at < :dateTo', {
          dateTo: this.clock.dayRange(tz, filters.dateTo).end,
        });
      } else {
        qb.andWhere('p.created_at <= :dateTo', { dateTo: filters.dateTo });
      }
    }

    qb.orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async listByPatient(
    patientId: string,
    organizationId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Prescription[]; total: number }> {
    const [data, total] = await this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.doctor', 'doctor')
      .leftJoinAndSelect('p.medicines', 'medicines')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.patient_id = :patientId', { patientId })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total };
  }

  async listByEncounter(
    encounterId: string,
    organizationId: string,
  ): Promise<Prescription[]> {
    return this.repo.find({
      where: { encounterId, organizationId },
      relations: ['doctor'],
      order: { createdAt: 'DESC' },
    });
  }

  async listByAppointment(
    appointmentId: string,
    organizationId: string,
  ): Promise<Prescription[]> {
    return this.repo.find({
      where: { appointmentId, organizationId },
      relations: ['doctor', 'medicines'],
      order: { createdAt: 'DESC' },
    });
  }

  async getStats(
    ctx: TenantContext,
    access: AccessContext,
  ): Promise<{
    total: number;
    thisMonth: number;
    finalized: number;
    draft: number;
  }> {
    // "This month" starts at 00:00 on the 1st in the LOCATION's timezone.
    const tz = await this.clock.timezoneFor(ctx.locationId);
    const monthStart = this.clock.dayRange(
      tz,
      `${this.clock.today(tz).slice(0, 7)}-01`,
    ).start;

    const base = this.repo
      .createQueryBuilder('p')
      .where('p.organization_id = :organizationId', {
        organizationId: ctx.organizationId,
      })
      .andWhere('p.location_id = :locationId', { locationId: ctx.locationId });
    access.applyScope(base, 'patients.view', patientScope('p.patient_id'));

    const total = await base.clone().getCount();
    const thisMonth = await base
      .clone()
      .andWhere('p.created_at >= :ms', { ms: monthStart })
      .getCount();
    const finalized = await base
      .clone()
      .andWhere('p.status = :s', { s: PrescriptionStatus.FINALIZED })
      .getCount();
    const draft = await base
      .clone()
      .andWhere('p.status = :s', { s: PrescriptionStatus.DRAFT })
      .getCount();

    return { total, thisMonth, finalized, draft };
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE (DRAFT or AMENDED only)
  // ═══════════════════════════════════════════════════════════

  async update(
    id: string,
    organizationId: string,
    dto: UpdatePrescriptionDto,
    changedBy: string,
  ): Promise<Prescription> {
    const row = await this.findOne(id, organizationId);
    const wasFinalized = row.status === PrescriptionStatus.FINALIZED;

    // Snapshot BEFORE mutating — for the audit trail.
    const snapshot = this.historyService.snapshot(row);

    await this.dataSource.transaction(async (manager) => {
      if (dto.medicines) {
        await manager.delete(PrescriptionMedicine, { prescriptionId: row.id });
        const newRows = manager.create(
          PrescriptionMedicine,
          dto.medicines.map((m, idx) => ({
            ...m,
            mealRelation: m.mealRelation ?? MealRelation.NONE,
            frequencyTiming: m.frequencyTiming ?? [],
            sortOrder: m.sortOrder ?? idx,
            prescriptionId: row.id,
          })),
        );
        // Keep the loaded relation in step with what is now in the table —
        // otherwise the cascade below sees the old rows and orphans the new.
        row.medicines = await manager.save(newRows);
      }

      const {
        medicines: _ignored,
        changeNotes: _ignored2,
        ...scalarFields
      } = dto;
      manager.merge(Prescription, row, scalarFields as any);

      // Amending a FINALIZED prescription bumps version + flips status,
      // and invalidates the cached PDF (caller can regenerate on next print).
      if (wasFinalized) {
        row.status = PrescriptionStatus.AMENDED;
        row.version = (row.version ?? 1) + 1;
        row.pdfUrl = null;
      }
      await manager.save(row);
    });

    await this.historyService.log({
      prescriptionId: row.id,
      version: row.version,
      changedBy,
      changeType: wasFinalized
        ? PrescriptionHistoryChangeType.AMENDED
        : PrescriptionHistoryChangeType.AMENDED,
      previousData: snapshot,
      changeNotes: dto.changeNotes ?? null,
    });

    return this.findOne(row.id, organizationId);
  }

  // ═══════════════════════════════════════════════════════════
  // MEDICINE LINE OPS (single-line shortcuts for the live editor)
  // ═══════════════════════════════════════════════════════════

  async addMedicine(
    prescriptionId: string,
    organizationId: string,
    dto: AddMedicineDto,
    changedBy: string,
  ): Promise<PrescriptionMedicine> {
    const p = await this.findOne(prescriptionId, organizationId);
    this.assertEditable(p);

    const maxSort =
      p.medicines && p.medicines.length > 0
        ? Math.max(...p.medicines.map((m) => m.sortOrder ?? 0))
        : -1;

    const row = this.medicineRepo.create({
      ...dto,
      prescriptionId: p.id,
      mealRelation: dto.mealRelation ?? MealRelation.NONE,
      frequencyTiming: dto.frequencyTiming ?? [],
      sortOrder: dto.sortOrder ?? maxSort + 1,
    });
    const saved = await this.medicineRepo.save(row);

    await this.historyService.log({
      prescriptionId: p.id,
      version: p.version,
      changedBy,
      changeType: PrescriptionHistoryChangeType.AMENDED,
      changeNotes: `Added medicine: ${row.medicineName}`,
    });
    return saved;
  }

  async updateMedicine(
    prescriptionId: string,
    medicineId: string,
    organizationId: string,
    dto: PrescriptionMedicineDto,
    changedBy: string,
  ): Promise<PrescriptionMedicine> {
    const p = await this.findOne(prescriptionId, organizationId);
    this.assertEditable(p);

    const row = await this.medicineRepo.findOne({
      where: { id: medicineId, prescriptionId },
    });
    if (!row) throw new NotFoundException('Medicine line not found');

    Object.assign(row, dto);
    const saved = await this.medicineRepo.save(row);

    await this.historyService.log({
      prescriptionId: p.id,
      version: p.version,
      changedBy,
      changeType: PrescriptionHistoryChangeType.AMENDED,
      changeNotes: `Updated medicine: ${saved.medicineName}`,
    });
    return saved;
  }

  async removeMedicine(
    prescriptionId: string,
    medicineId: string,
    organizationId: string,
    changedBy: string,
  ): Promise<{ id: string }> {
    const p = await this.findOne(prescriptionId, organizationId);
    this.assertEditable(p);

    const row = await this.medicineRepo.findOne({
      where: { id: medicineId, prescriptionId },
    });
    if (!row) throw new NotFoundException('Medicine line not found');
    const name = row.medicineName;
    await this.medicineRepo.remove(row);

    await this.historyService.log({
      prescriptionId: p.id,
      version: p.version,
      changedBy,
      changeType: PrescriptionHistoryChangeType.AMENDED,
      changeNotes: `Removed medicine: ${name}`,
    });
    return { id: medicineId };
  }

  // ═══════════════════════════════════════════════════════════
  // FINALIZE
  // ═══════════════════════════════════════════════════════════

  async finalize(
    id: string,
    organizationId: string,
    dto: FinalizePrescriptionDto,
    doctorId: string,
  ): Promise<Prescription> {
    const p = await this.findOne(id, organizationId);
    if (
      p.status !== PrescriptionStatus.DRAFT &&
      p.status !== PrescriptionStatus.AMENDED
    ) {
      throw new BadRequestException(
        'Only DRAFT or AMENDED prescriptions can be finalized',
      );
    }
    if (!p.medicines || p.medicines.length === 0) {
      throw new BadRequestException(
        'Cannot finalize a prescription with no medicines',
      );
    }

    // Resolve signature: explicit > doctor's saved.
    let signatureImageUrl = dto.signatureImageUrl ?? null;
    if (!signatureImageUrl) {
      const saved = await this.signatureService.getByEmployee(doctorId);
      signatureImageUrl = saved?.signatureImageUrl ?? null;
    }

    p.status = PrescriptionStatus.FINALIZED;
    p.signedAt = new Date();
    p.signatureImageUrl = signatureImageUrl;
    p.pdfUrl = null; // regenerated on next PDF request
    await this.repo.save(p);

    // Best-effort PDF generation; failure here shouldn't block finalize since
    // the record is already saved and printable on demand.
    try {
      const url = await this.pdfService.generatePdfUrl(p.id, organizationId);
      if (url) {
        p.pdfUrl = url;
        await this.repo.save(p);
      }
    } catch {
      // ignore — print endpoint regenerates on the fly
    }

    await this.historyService.log({
      prescriptionId: p.id,
      version: p.version,
      changedBy: doctorId,
      changeType: PrescriptionHistoryChangeType.FINALIZED,
      changeNotes: dto.changeNotes ?? null,
    });

    return this.findOne(p.id, organizationId);
  }

  // ═══════════════════════════════════════════════════════════
  // DUPLICATE
  // ═══════════════════════════════════════════════════════════

  async duplicate(
    id: string,
    ctx: TenantContext,
    doctorId: string,
  ): Promise<Prescription> {
    const source = await this.findOne(id, ctx.organizationId);
    return this.create(
      ctx,
      {
        patientId: source.patientId,
        appointmentId: undefined,
        prescriptionTemplateId: source.prescriptionTemplateId ?? undefined,
        diagnosis: source.diagnosis ?? undefined,
        chiefComplaint: source.chiefComplaint ?? undefined,
        furtherPlan: source.furtherPlan ?? undefined,
        instructionsEnglish: source.instructionsEnglish ?? undefined,
        instructionsUrdu: source.instructionsUrdu ?? undefined,
        vitals: source.vitals ?? undefined,
        medicines: (source.medicines ?? []).map((m) => ({
          medicineDirectoryId: m.medicineDirectoryId ?? undefined,
          medicineName: m.medicineName,
          medicineNameUrdu: m.medicineNameUrdu ?? undefined,
          type: m.type ?? undefined,
          dosage: m.dosage,
          frequency: m.frequency,
          frequencyTiming: m.frequencyTiming ?? [],
          mealRelation: m.mealRelation,
          duration: m.duration,
          specialInstructions: m.specialInstructions ?? undefined,
          specialInstructionsUrdu: m.specialInstructionsUrdu ?? undefined,
          sortOrder: m.sortOrder,
        })),
      },
      doctorId,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private assertEditable(p: Prescription) {
    if (
      p.status !== PrescriptionStatus.DRAFT &&
      p.status !== PrescriptionStatus.AMENDED
    ) {
      throw new BadRequestException(
        'Finalized prescriptions cannot be edited — amend instead',
      );
    }
  }

  /**
   * Sequential per-org: `RX-{YYYY}-{5-digit}`. Same algorithm as invoices.
   */
  private async generatePrescriptionNumber(
    organizationId: string,
    locationId: string,
  ): Promise<string> {
    const last = await this.repo.findOne({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    // The year in the number is the clinic's year, not the server's.
    const year = this.clock
      .today(await this.clock.timezoneFor(locationId))
      .slice(0, 4);
    let seq = 1;
    if (last?.prescriptionNumber) {
      const parts = last.prescriptionNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `RX-${year}-${String(seq).padStart(5, '0')}`;
  }

  // Suppress unused-import warning for Brackets — reserved for later filters.
  private readonly _bracketsRef = Brackets;
}
