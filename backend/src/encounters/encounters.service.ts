import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { QueueEntry } from 'src/queue/entities/queue-entry.entity';
import { QueueSession } from 'src/queue/entities/queue-session.entity';
import type { AccessContext } from 'src/access/access-context';
import { PatientEncounter } from './entities/patient-encounter.entity';
import { UpdateEncounterNotesDto } from './dto/update-encounter-notes.dto';

/** Everything the consultation screen needs about the live queue entry. */
export interface ConsultationWorkspace {
  encounter: PatientEncounter;
  queueEntry: {
    id: string;
    token: string;
    status: string;
    version: number;
    sessionId: string;
  } | null;
  doctor: { id: string; fullName: string } | null;
}

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

  /** The encounter plus the queue entry (for Complete) and the doctor in charge. */
  async getWorkspace(
    id: string,
    ctx: TenantContext,
  ): Promise<ConsultationWorkspace> {
    const encounter = await this.findOne(id, ctx);
    const entry = await this.encounterRepo.manager
      .getRepository(QueueEntry)
      .findOne({
        where: { id: encounter.queueEntryId },
        relations: { session: { doctor: true } },
      });
    const { queueEntry: _omit, ...rest } = encounter;
    return {
      encounter: rest as PatientEncounter,
      queueEntry: entry
        ? {
            id: entry.id,
            token: `${entry.session.tokenPrefix}-${String(entry.tokenNumber).padStart(3, '0')}`,
            status: entry.status,
            version: entry.version,
            sessionId: entry.queueSessionId,
          }
        : null,
      doctor: entry?.session?.doctor
        ? {
            id: entry.session.doctor.id,
            fullName: entry.session.doctor.fullName,
          }
        : null,
    };
  }

  /**
   * `consultation.conduct` reach for one encounter: `own` → only the doctor
   * of the queue session it came from, `location` / `org` → any encounter
   * here. Outside that reach it reads as not found.
   */
  async assertConductScope(
    id: string,
    ctx: TenantContext,
    access: AccessContext,
  ): Promise<void> {
    const qb = this.encounterRepo
      .createQueryBuilder('enc')
      .innerJoin(QueueEntry, 'e', 'e.id = enc.queue_entry_id')
      .innerJoin(QueueSession, 's', 's.id = e.queue_session_id')
      .where('enc.id = :id', { id })
      .andWhere('enc.organization_id = :org', { org: ctx.organizationId })
      .andWhere('enc.location_id = :loc', { loc: ctx.locationId });
    access.applyScope(qb, 'consultation.conduct', {
      own: 's.doctor_id',
      location: 'enc.location_id',
    });
    if ((await qb.getCount()) === 0) {
      throw new NotFoundException('Encounter not found');
    }
  }

  /** Reload-safe way back into a consultation from the doctor's queue screen. */
  async getWorkspaceByQueueEntry(
    queueEntryId: string,
    ctx: TenantContext,
    access: AccessContext,
  ): Promise<ConsultationWorkspace> {
    const encounter = await this.encounterRepo.findOne({
      where: {
        queueEntryId,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
      select: { id: true },
    });
    if (!encounter) {
      throw new NotFoundException('This patient has not been started yet');
    }
    await this.assertConductScope(encounter.id, ctx, access);
    return this.getWorkspace(encounter.id, ctx);
  }

  /** Auto-save target — only the fields present in the body are touched. */
  async updateNotes(
    id: string,
    ctx: TenantContext,
    dto: UpdateEncounterNotesDto,
    userId: string | null,
  ): Promise<PatientEncounter> {
    const encounter = await this.encounterRepo.findOne({
      where: {
        id,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    const blank = (v: string | null | undefined) =>
      v === undefined ? undefined : v === null || v.trim() === '' ? null : v;
    const patch: Partial<PatientEncounter> = {
      chiefComplaint: blank(dto.chiefComplaint),
      examination: blank(dto.examination),
      diagnosis: blank(dto.diagnosis),
      advice: blank(dto.advice),
      followUpDate: blank(dto.followUpDate),
    };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (encounter as any)[key] = value;
    }
    encounter.updatedBy = userId;
    return this.encounterRepo.save(encounter);
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
