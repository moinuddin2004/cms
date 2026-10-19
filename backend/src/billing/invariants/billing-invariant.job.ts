import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BillingInvariantChecker } from './billing-invariant-checker';

/**
 * Nightly audit of the money invariants I1–I10 (incl. the commission
 * ledger) for every patient with billing rows. Read-only: it only logs
 * violations so ops can investigate; nothing is repaired automatically.
 * Runs where scheduled jobs run (ScheduleModule, worker / all-in-one).
 */
@Injectable()
export class BillingInvariantJob {
  private readonly logger = new Logger(BillingInvariantJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly checker: BillingInvariantChecker,
  ) {}

  @Cron('30 2 * * *', { name: 'billing-invariants' })
  async run(): Promise<{ patients: number; violations: number }> {
    const rows: Array<{
      organization_id: string;
      location_id: string;
      patient_id: string;
    }> = await this.dataSource.query(
      `SELECT organization_id, location_id, patient_id FROM charges
        UNION
       SELECT organization_id, location_id, patient_id FROM payments`,
    );
    let violations = 0;
    for (const r of rows) {
      try {
        const found = await this.checker.checkPatient(
          this.dataSource.manager,
          { organizationId: r.organization_id, locationId: r.location_id },
          r.patient_id,
        );
        for (const v of found) {
          violations++;
          this.logger.error(
            `[${v.invariant}] org ${r.organization_id} loc ${r.location_id} patient ${r.patient_id}: ${v.message}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Invariant check failed for patient ${r.patient_id}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(
      `Billing invariants: ${rows.length} patient(s) checked, ${violations} violation(s)`,
    );
    return { patients: rows.length, violations };
  }
}
