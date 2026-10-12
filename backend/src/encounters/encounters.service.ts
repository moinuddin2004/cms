import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { QueueEntry } from 'src/queue/entities/queue-entry.entity';
import { PatientEncounter } from './entities/patient-encounter.entity';

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(PatientEncounter)
    private readonly encounterRepo: Repository<PatientEncounter>,
  ) {}

  /**
   * Idempotently create the encounter for a queue entry when the doctor
   * starts the consultation. Runs inside the queue orchestrator's
   * transaction (`tx`), so the encounter and the status change commit
   * together. Safe to call twice — returns the existing encounter.
   */
  async ensureForQueueEntry(
    tx: EntityManager,
    entry: Pick<
      QueueEntry,
      'id' | 'patientId' | 'organizationId' | 'appointmentId' | 'reasonForVisit'
    >,
    locationId: string,
    userId: string | null,
  ): Promise<PatientEncounter> {
    const repo = tx.getRepository(PatientEncounter);
    const existing = await repo.findOne({ where: { queueEntryId: entry.id } });
    if (existing) return existing;

    return repo.save(
      repo.create({
        queueEntryId: entry.id,
        appointmentId: entry.appointmentId,
        patientId: entry.patientId,
        organizationId: entry.organizationId,
        locationId,
        encounterDate: new Date(),
        reason: entry.reasonForVisit ?? null,
        createdBy: userId,
        updatedBy: userId,
      }),
    );
  }

  /** Flow H — the encounter plus its source appointment, patient and treatments. */
  async findOne(id: string, ctx: TenantContext): Promise<PatientEncounter> {
    const encounter = await this.encounterRepo.findOne({
      where: {
        id,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
      relations: {
        appointment: true,
        queueEntry: true,
        patient: true,
        treatments: true,
      },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
    encounter.treatments?.sort((a, b) => b.date.getTime() - a.date.getTime());
    return encounter;
  }

  /** Flow G — all encounters for a patient, each with its treatments. */
  async findByPatient(
    patientId: string,
    ctx: TenantContext,
  ): Promise<PatientEncounter[]> {
    const encounters = await this.encounterRepo.find({
      where: { patientId, organizationId: ctx.organizationId },
      relations: { treatments: true },
      order: { encounterDate: 'DESC' },
    });
    for (const e of encounters) {
      e.treatments?.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    return encounters;
  }
}
