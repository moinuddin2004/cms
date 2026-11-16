import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MedicationSyncService } from './medication-sync.service';

const SWEEP_EVERY_MS = 5 * 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;
/** Only recent prescriptions are repaired; older ones are the patient's history. */
const LOOKBACK_DAYS = 14;
const BATCH = 200;

/**
 * Repairs missed syncs (M3-01). The in-process `prescription.issued` event
 * is lost on a crash/restart/throw; this sweep re-runs the idempotent
 * `syncPrescription` for finalized prescriptions that have an active-linked
 * profile whose schedules are missing or behind `prescriptions.version`
 * (the marker stamped by every sync). It also covers a patient who links
 * shortly after a prescription was issued. Runs once shortly after boot
 * and then periodically, wherever scheduled jobs run.
 */
@Injectable()
export class MedicationSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MedicationSweepService.name);
  private startup?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly sync: MedicationSyncService,
  ) {}

  onModuleInit(): void {
    this.startup = setTimeout(() => void this.sweep(), STARTUP_DELAY_MS);
    this.startup.unref();
  }

  onModuleDestroy(): void {
    if (this.startup) clearTimeout(this.startup);
  }

  @Interval(SWEEP_EVERY_MS)
  async sweep(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let repaired = 0;
    try {
      const rows: { id: string }[] = await this.dataSource.query(
        `SELECT p.id
           FROM prescriptions p
          WHERE p.status = 'FINALIZED'
            AND p.signed_at >= now() - ($1::int * interval '1 day')
            AND EXISTS (
              SELECT 1 FROM patient_record_links l
               WHERE l.organization_id = p.organization_id
                 AND l.patient_id = p.patient_id
                 AND l.status = 'active'
                 AND NOT EXISTS (
                   SELECT 1 FROM medication_schedules s
                    WHERE s.profile_id = l.profile_id
                      AND s.prescription_id = p.id
                      AND s.prescription_version >= p.version))
          ORDER BY p.signed_at DESC
          LIMIT ${BATCH}`,
        [LOOKBACK_DAYS],
      );
      for (const { id } of rows) {
        try {
          await this.sync.syncPrescription(id);
          repaired += 1;
        } catch (err) {
          this.logger.error(
            `sweep: sync of prescription ${id} failed: ${(err as Error).message}`,
          );
        }
      }
      if (repaired > 0) this.logger.log(`sweep re-synced ${repaired} prescription(s)`);
    } catch (err) {
      this.logger.error(`medication sweep failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
    return repaired;
  }
}
