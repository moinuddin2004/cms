import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Patient } from 'src/patients/entities/patient.entity';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
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
  ) {}

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

    const treatment = this.treatmentRepo.create({
      patientId: dto.patientId,
      encounterId: dto.encounterId ?? null,
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      treatmentName: dto.treatmentName,
      notes: dto.notes ?? null,
      cost: dto.cost ?? null,
      date: dto.date ? new Date(dto.date) : new Date(),
      createdBy: userId,
    });

    return this.treatmentRepo.save(treatment);
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
      order: { date: 'DESC' },
    });
  }

  async findByEncounter(encounterId: string, ctx: TenantContext): Promise<Treatment[]> {
    return this.treatmentRepo.find({
      where: { encounterId, organizationId: ctx.organizationId },
      order: { date: 'DESC' },
    });
  }
}
