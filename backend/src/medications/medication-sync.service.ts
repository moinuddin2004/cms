import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { PatientProfile } from 'src/patient-app/entities/patient-profile.entity';
import { PatientRecordLink } from 'src/patient-app/entities/patient-record-link.entity';
import { Prescription } from 'src/prescriptions/entities/prescription.entity';
import { PrescriptionMedicine } from 'src/prescriptions/entities/prescription-medicine.entity';
import { PrescriptionStatus } from 'src/prescriptions/enums/prescription-status.enum';
import { MedicationSchedule } from './entities/medication-schedule.entity';
import {
  computeEndDate,
  parseDoseTimes,
  parseDurationDays,
} from './parsing/medication-parsers';

export interface SyncResult {
  profiles: number;
  created: number;
  updated: number;
  stopped: number;
}

const EMPTY: SyncResult = { profiles: 0, created: 0, updated: 0, stopped: 0 };

const normName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
const clip = (value: string, max: number) =>
  value.length > max ? value.slice(0, max) : value;

/**
 * Creates / updates the patient-side medication schedules of a finalized
 * prescription (M3-01). Idempotent: calling it again for the same prescription
 * (finalize after an amendment, retry, backfill) updates in place.
 *
 * - one schedule per (linked profile, medicine line); only ACTIVE links of a
 *   clinic with `patient_app` enabled get new schedules (revoked / frozen: none);
 * - an amended prescription re-creates its medicine rows with new ids, so lines
 *   are matched by id first and then by normalized name;
 * - a schedule the patient edited keeps its times / end date / status;
 * - a schedule whose line was removed by the amendment is stopped.
 */
@Injectable()
export class MedicationSyncService {
  private readonly logger = new Logger(MedicationSyncService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async syncPrescription(prescriptionId: string): Promise<SyncResult> {
    const rx = await this.dataSource.getRepository(Prescription).findOne({
      where: { id: prescriptionId },
      relations: { medicines: true },
    });
    if (!rx || rx.status !== PrescriptionStatus.FINALIZED || !rx.signedAt) {
      return { ...EMPTY };
    }

    const links = await this.dataSource.getRepository(PatientRecordLink).find({
      where: {
        organizationId: rx.organizationId,
        patientId: rx.patientId,
        status: 'active',
      },
    });
    const result: SyncResult = { ...EMPTY };
    const activeProfileIds: string[] = [
      ...new Set<string>(links.map((l) => l.profileId)),
    ];

    // Profiles whose link is no longer active keep what they have but get
    // nothing new, and an active course is stopped (A-23).
    result.stopped += await this.stopForInactiveLinks(rx.id, activeProfileIds);

    if (links.length === 0) return result;
    // Honours location overrides: the prescription's own location decides.
    if (
      !(await this.featureFlags.isFeatureEnabled(
        rx.organizationId,
        'patient_app',
        rx.locationId,
      ))
    ) {
      return result;
    }

    const tz = await this.clock.timezoneFor(rx.locationId);
    const startDate = this.clock.today(tz, rx.signedAt);
    const medicines = [...(rx.medicines ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const profileIds = activeProfileIds;

    for (const profileId of profileIds) {
      await this.dataSource.transaction(async (manager) => {
        // Serialize concurrent syncs of one prescription (event + sweep).
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [rx.id]);
        const r = await this.syncProfile(manager, rx, medicines, profileId, startDate);
        result.created += r.created;
        result.updated += r.updated;
        result.stopped += r.stopped;
        result.profiles += 1;
        await this.publishFeedChanged(manager, rx.organizationId, profileId);
      });
    }
    this.logger.log(
      `prescription ${rx.id}: ${result.created} created, ${result.updated} updated, ${result.stopped} stopped for ${result.profiles} profile(s)`,
    );
    return result;
  }

  private async stopForInactiveLinks(
    prescriptionId: string,
    activeProfileIds: string[],
  ): Promise<number> {
    const res: unknown = await this.dataSource.query(
      `UPDATE medication_schedules
          SET status = 'stopped', updated_at = now()
        WHERE prescription_id = $1 AND source = 'prescription'
          AND status IN ('active', 'paused')
          AND NOT (profile_id = ANY($2::uuid[]))`,
      [prescriptionId, activeProfileIds],
    );
    return Array.isArray(res) && typeof res[1] === 'number' ? res[1] : 0;
  }

  private async syncProfile(
    manager: EntityManager,
    rx: Prescription,
    medicines: PrescriptionMedicine[],
    profileId: string,
    startDate: string,
  ): Promise<Pick<SyncResult, 'created' | 'updated' | 'stopped'>> {
    const repo = manager.getRepository(MedicationSchedule);
    const existing = await repo.find({
      where: { profileId, prescriptionId: rx.id, source: 'prescription' },
    });

    // Pair every medicine line with at most one existing schedule.
    const pairs = new Map<string, MedicationSchedule>();
    const taken = new Set<string>();
    for (const m of medicines) {
      const hit = existing.find(
        (s) => !taken.has(s.id) && s.prescriptionMedicineId === m.id,
      );
      if (hit) {
        pairs.set(m.id, hit);
        taken.add(hit.id);
      }
    }
    for (const m of medicines) {
      if (pairs.has(m.id)) continue;
      const hit = existing.find(
        (s) => !taken.has(s.id) && normName(s.name) === normName(m.medicineName),
      );
      if (hit) {
        pairs.set(m.id, hit);
        taken.add(hit.id);
      }
    }

    let created = 0;
    let updated = 0;
    let stopped = 0;

    for (const m of medicines) {
      const parsed = parseDoseTimes(m.frequencyTiming, m.frequency);
      const days = parseDurationDays(m.duration);
      const row = pairs.get(m.id);

      if (!row) {
        const endDate = computeEndDate(startDate, days);
        await repo.insert({
          profileId,
          source: 'prescription',
          organizationId: rx.organizationId,
          prescriptionId: rx.id,
          prescriptionMedicineId: m.id,
          name: clip(m.medicineName, 200),
          nameUrdu: m.medicineNameUrdu ? clip(m.medicineNameUrdu, 200) : null,
          doseText: clip(m.dosage, 120),
          times: parsed.times,
          mealRelation: m.mealRelation,
          startDate,
          endDate,
          endDateSource: endDate ? 'parsed' : 'unknown',
          status: 'active',
          instructions: m.specialInstructions,
          instructionsUrdu: m.specialInstructionsUrdu,
          patientEdited: false,
          prescriptionVersion: rx.version ?? 1,
          hidden: false,
        });
        created += 1;
        continue;
      }

      row.prescriptionMedicineId = m.id;
      row.name = clip(m.medicineName, 200);
      row.nameUrdu = m.medicineNameUrdu ? clip(m.medicineNameUrdu, 200) : null;
      row.doseText = clip(m.dosage, 120);
      row.mealRelation = m.mealRelation;
      row.instructions = m.specialInstructions;
      row.instructionsUrdu = m.specialInstructionsUrdu;
      row.prescriptionVersion = rx.version ?? 1;
      row.hidden = false; // the profile has an active link again
      if (!row.patientEdited) {
        const endDate = computeEndDate(row.startDate, days);
        row.times = parsed.times;
        row.endDate = endDate;
        row.endDateSource = endDate ? 'parsed' : 'unknown';
        row.status = 'active';
      }
      await repo.save(row);
      updated += 1;
    }

    for (const s of existing) {
      if (taken.has(s.id)) continue;
      if (s.status === 'active' || s.status === 'paused') {
        s.status = 'stopped';
        await repo.save(s);
        stopped += 1;
      }
    }
    return { created, updated, stopped };
  }

  /** Realtime hint for the patient's app (outbox → `patient:<accountId>`, 07 §7). */
  private async publishFeedChanged(
    manager: EntityManager,
    organizationId: string,
    profileId: string,
  ): Promise<void> {
    const profile = await manager
      .getRepository(PatientProfile)
      .findOne({ where: { id: profileId }, select: { id: true, accountId: true } });
    if (!profile) return;
    await manager.query(
      `INSERT INTO outbox (organization_id, topic, payload) VALUES ($1, $2, $3)`,
      [
        organizationId,
        `patient:${profile.accountId}`,
        JSON.stringify({ type: 'feed.changed', kinds: ['medications'] }),
      ],
    );
    await manager.query(`SELECT pg_notify('queue_outbox', '')`);
  }
}
