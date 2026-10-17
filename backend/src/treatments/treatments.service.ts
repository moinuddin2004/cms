import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Patient } from 'src/patients/entities/patient.entity';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { PlanTemplate } from 'src/plan-templates/entities/plan-template.entity';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import { Treatment } from './entities/treatment.entity';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { CreateEncounterTreatmentDto } from './dto/create-encounter-treatment.dto';

@Injectable()
export class TreatmentsService {
  constructor(
    @InjectRepository(Treatment)
    private readonly treatmentRepo: Repository<Treatment>,
    @InjectRepository(PatientEncounter)
    private readonly encounterRepo: Repository<PatientEncounter>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(PlanTemplate)
    private readonly planTemplateRepo: Repository<PlanTemplate>,
    @InjectRepository(CatalogService)
    private readonly catalogRepo: Repository<CatalogService>,
  ) {}

  /**
   * The procedures a doctor can pick from — name only. Prices stay in billing
   * (`GET /billing/services` is admin + reception), so doctors never see them.
   */
  async listProcedureCatalog(
    ctx: TenantContext,
  ): Promise<Array<Pick<CatalogService, 'id' | 'name' | 'code'>>> {
    return this.catalogRepo.find({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        kind: ServiceKind.PROCEDURE,
      },
      select: { id: true, name: true, code: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Flow F (standalone) + Flow E (when `encounterId` is set in the body).
   * A treatment always requires a patient; the encounter link is optional.
   */
  async create(
    ctx: TenantContext,
    dto: CreateTreatmentDto,
    userId: string,
  ): Promise<Treatment> {
    const patient = await this.patientRepo.findOne({
      where: { id: dto.patientId, organizationId: ctx.organizationId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    if (dto.encounterId) {
      const encounter = await this.encounterRepo.findOne({
        where: {
          id: dto.encounterId,
          organizationId: ctx.organizationId,
          locationId: ctx.locationId,
        },
      });
      if (!encounter) throw new NotFoundException('Encounter not found');
      // Business rule #4 — a linked treatment must belong to the encounter's patient.
      if (encounter.patientId !== dto.patientId) {
        throw new BadRequestException(
          'Treatment patient does not match the encounter patient',
        );
      }
    }

    if (dto.planTemplateId) {
      const plan = await this.planTemplateRepo.findOne({
        where: { id: dto.planTemplateId, organizationId: ctx.organizationId },
      });
      if (!plan) throw new NotFoundException('Treatment plan not found');
    }

    const service = dto.serviceId
      ? await this.procedureOrFail(ctx, dto.serviceId)
      : null;
    const treatmentName = dto.treatmentName?.trim() || service?.name;
    if (!treatmentName) {
      throw new BadRequestException('Pick a service or enter a treatment name');
    }

    const treatment = this.treatmentRepo.create({
      patientId: dto.patientId,
      encounterId: dto.encounterId ?? null,
      planTemplateId: dto.planTemplateId ?? null,
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      treatmentName,
      notes: dto.notes ?? null,
      serviceId: service?.id ?? null,
      // A catalog service prices the charge; the legacy fee only applies without one.
      cost: service ? null : (dto.cost ?? null),
      date: dto.date ? new Date(dto.date) : new Date(),
      createdBy: userId,
    });

    return this.treatmentRepo.save(treatment);
  }

  private async procedureOrFail(
    ctx: TenantContext,
    serviceId: string,
  ): Promise<CatalogService> {
    const service = await this.catalogRepo.findOne({
      where: { id: serviceId, organizationId: ctx.organizationId },
    });
    if (!service) throw new NotFoundException('Service not found');
    if (!service.isActive || service.kind !== ServiceKind.PROCEDURE) {
      throw new UnprocessableEntityException({
        code: 'TREATMENT_SERVICE_INVALID',
        message: 'Pick an active procedure from the service catalog',
      });
    }
    return service;
  }

  /**
   * Flow E — patient is derived from the encounter, so no mismatch is possible.
   */
  async createForEncounter(
    ctx: TenantContext,
    encounterId: string,
    body: CreateEncounterTreatmentDto,
    userId: string,
  ): Promise<Treatment> {
    const encounter = await this.encounterRepo.findOne({
      where: {
        id: encounterId,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    return this.create(
      ctx,
      { ...body, patientId: encounter.patientId, encounterId },
      userId,
    );
  }

  async findByPatient(patientId: string, ctx: TenantContext): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { patientId, organizationId: ctx.organizationId },
      relations: { planTemplate: true },
      order: { date: 'DESC' },
    });
  }

  async findByEncounter(encounterId: string, ctx: TenantContext): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { encounterId, organizationId: ctx.organizationId },
      relations: { planTemplate: true },
      order: { date: 'DESC' },
    });
  }
}
