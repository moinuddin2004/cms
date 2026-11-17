import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Interval, SchedulerRegistry } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { MedicationSyncService } from './medication-sync.service';

const SWEEP_EVERY_MS = 5 * 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;
/** Only recent prescriptions are repaired; older ones are the patient's history. */
const LOOKBACK_DAYS = 14;
const BATCH = 200;
/** Upper bound on pages scanned per run (skipped clinics cost a page each). */
const MAX_PAGES = 10;

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
    private readonly featureFlags: FeatureFlagsService,
    /** Provided by ScheduleModule, which only exists where jobs run (L19). */
    @Optional() private readonly scheduler?: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    // A pure api process runs no jobs, so no startup sweep either: several
    // processes syncing the same prescriptions at boot would race.
    if (!this.scheduler) return;
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
      const rows = await this.findCandidates();
      for (const id of rows) {
        try {
          await this.sync.syncPrescription(id);
          repaired += 1;
        } catch (err) {
          this.logger.error(
            `sweep: sync of prescription ${id} failed: ${(err as Error).message}`,
          );
        }
      }
      if (repaired > 0)
        this.logger.log(`sweep re-synced ${repaired} prescription(s)`);
    } catch (err) {
      this.logger.error(`medication sweep failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
    return repaired;
  }

  /**
   * Prescriptions whose active-linked profiles lack an up-to-date, visible
   * schedule, newest first, paged by (signed_at, id). Clinics with the
   * patient app off (per prescription location) are skipped here, so they can
   * never fill the batch and starve repairs elsewhere (M10). Hidden schedules
   * (clinic revoke) count as missing, so a re-claimed profile is repaired (M11).
   */
  private async findCandidates(): Promise<string[]> {
    const ids: string[] = [];
    const enabled = new Map<string, boolean>();
    let cursor: { signedAt: unknown; id: string } | null = null;
    for (let page = 0; page < MAX_PAGES && ids.length < BATCH; page += 1) {
      const rows: {
        id: string;
        organization_id?: string;
        location_id?: string | null;
        signed_at?: unknown;
      }[] = await this.dataSource.query(
        `SELECT p.id, p.organization_id, p.location_id, p.signed_at
           FROM prescriptions p
          WHERE p.status = 'FINALIZED'
            AND p.signed_at >= now() - ($1::int * interval '1 day')
            ${cursor ? 'AND (p.signed_at, p.id) < ($2::timestamptz, $3::uuid)' : ''}
            AND EXISTS (
              SELECT 1 FROM patient_record_links l
               WHERE l.organization_id = p.organization_id
                 AND l.patient_id = p.patient_id
                 AND l.status = 'active'
                 AND NOT EXISTS (
                   SELECT 1 FROM medication_schedules s
                    WHERE s.profile_id = l.profile_id
                      AND s.prescription_id = p.id
                      AND NOT s.hidden
                      AND s.prescription_version >= p.version))
          ORDER BY p.signed_at DESC, p.id DESC
          LIMIT ${BATCH}`,
        cursor ? [LOOKBACK_DAYS, cursor.signedAt, cursor.id] : [LOOKBACK_DAYS],
      );
      for (const r of rows) {
        if (ids.length >= BATCH) break;
        if (r.organization_id) {
          const key = `${r.organization_id}|${r.location_id ?? ''}`;
          let on = enabled.get(key);
          if (on === undefined) {
            on = await this.featureFlags.isFeatureEnabled(
              r.organization_id,
              'patient_app',
              r.location_id ?? null,
            );
            enabled.set(key, on);
          }
          if (!on) continue;
        }
        ids.push(r.id);
      }
      if (rows.length < BATCH) break;
      const last = rows[rows.length - 1];
      cursor = { signedAt: last.signed_at, id: last.id };
    }
    return ids;
  }
}
