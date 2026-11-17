import {
  DynamicModule,
  Inject,
  Injectable,
  Logger,
  Module,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProcessRole, runsJobs } from 'src/common/runtime/process-role';
import {
  PATIENT_LIMITS,
  readPatientLimits,
  type PatientLimits,
} from './patient-config';

/**
 * Daily retention for what the privacy policy promises (audit M9):
 * - `patient_sessions` that ended (revoked or expired) more than `sessionRetentionMonths` ago
 *   (live sessions are never touched; a revoke already nulls IP / device label);
 * - `product_events` older than `productEventRetentionDays`;
 * - `patient_login_codes` expired more than `loginCodeRetentionDays` ago (kept ≥ 24 h so the
 *   per-email failed-guess counter keeps working).
 * A value of 0 keeps that table forever. Values live in `PatientLimits` (env, documented defaults
 * in the root CLAUDE.md). Registered only where scheduled jobs run (`runsJobs(role)`).
 */
@Injectable()
export class PatientRetentionJob {
  private readonly log = new Logger(PatientRetentionJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional()
    @Inject(PATIENT_LIMITS)
    private readonly limits: PatientLimits = readPatientLimits(),
  ) {}

  @Cron('15 3 * * *', { name: 'patient-retention' })
  async run(): Promise<{ sessions: number; events: number; codes: number }> {
    const l = this.limits;
    const sessions =
      l.sessionRetentionMonths > 0
        ? await this.purge(
            `DELETE FROM patient_sessions
              WHERE LEAST(COALESCE(revoked_at, expires_at), expires_at)
                    < now() - make_interval(months => $1)`,
            l.sessionRetentionMonths,
          )
        : 0;
    const events =
      l.productEventRetentionDays > 0
        ? await this.purge(
            `DELETE FROM product_events WHERE at < now() - make_interval(days => $1)`,
            l.productEventRetentionDays,
          )
        : 0;
    const codes =
      l.loginCodeRetentionDays > 0
        ? await this.purge(
            `DELETE FROM patient_login_codes
              WHERE expires_at < now() - make_interval(days => $1)`,
            l.loginCodeRetentionDays,
          )
        : 0;
    this.log.log(
      `retention: ${sessions} sessions, ${events} events, ${codes} login codes`,
    );
    return { sessions, events, codes };
  }

  /** `DELETE … RETURNING`-free count: pg returns [rows, count] for DELETE through TypeORM. */
  private async purge(sql: string, amount: number): Promise<number> {
    const res: unknown = await this.dataSource.query(sql, [amount]);
    return Array.isArray(res) && typeof res[1] === 'number' ? res[1] : 0;
  }
}

/** The job exists only where background jobs run (worker / all), never on a second API. */
@Module({})
export class PatientRetentionRuntimeModule {
  static forRole(role: ProcessRole): DynamicModule {
    return {
      module: PatientRetentionRuntimeModule,
      providers: runsJobs(role)
        ? [
            { provide: PATIENT_LIMITS, useFactory: () => readPatientLimits() },
            PatientRetentionJob,
          ]
        : [],
    };
  }
}
