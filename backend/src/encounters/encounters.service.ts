import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { AppointmentStatus } from 'src/common/enums/appointment-status.enum';
import { PatientEncounter } from './entities/patient-encounter.entity';

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(PatientEncounter)
    private readonly encounterRepo: Repository<PatientEncounter>,
  ) {}

  /**
   * Idempotently create the encounter for an appointment at the moment the
   * patient actually arrives (check-in / walk-in / complete). Safe to call more
   * than once — returns the existing encounter if one is already present.
   *
   * Business rule: a visit can never come from a cancelled / no-show appointment.
   */
  async ensureEncounterForAppointment(
    ctx: TenantContext,
    appointment: Appointment,
    userId?: string,
  ): Promise<PatientEncounter> {
    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.NO_SHOW
    ) {
      throw new BadRequestException(
        'Cannot create a visit for a cancelled or no-show appointment',
      );
    }

    const existing = await this.encounterRepo.findOne({
      where: { appointmentId: appointment.id },
    });
    if (existing) return existing;

    const encounter = this.encounterRepo.create({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      organizationId: appointment.organizationId,
      locationId: appointment.locationId,
      encounterDate: new Date(),
      reason: appointment.reasonForVisit ?? null,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });

    try {
      return await this.encounterRepo.save(encounter);
    } catch (err) {
      // Lost a race on the unique appointment_id — return the winner's row.
      if (err instanceof QueryFailedError) {
        const winner = await this.encounterRepo.findOne({
          where: { appointmentId: appointment.id },
        });
        if (winner) return winner;
      }
      throw err;
    }
  }

  async hasEncounterForAppointment(
    ctx: TenantContext,
    appointmentId: string,
  ): Promise<boolean> {
    const count = await this.encounterRepo.count({
      where: { appointmentId, locationId: ctx.locationId },
    });
    return count > 0;
  }

  /** Flow H — the encounter plus its source appointment, patient and treatments. */
  async findOne(id: string, ctx: TenantContext): Promise<PatientEncounter> {
    const encounter = await this.encounterRepo.findOne({
      where: {
        id,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
      relations: { appointment: true, patient: true, treatments: true },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
    encounter.treatments?.sort((a, b) => b.date.getTime() - a.date.getTime());
    return encounter;
  }

  /** Flow G — all encounters for a patient, each with its treatments. */
  async findByPatient(patientId: string, ctx: TenantContext): Promise<PatientEncounter[]> {
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
