import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueueOrchestrator } from '../services/queue-orchestrator.service';
import { QueuePoliciesService } from '../services/queue-policies.service';
import { ClockService } from 'src/common/clock/clock.service';

/**
 * Queue background jobs. Rule: never trust the job's own view — each one
 * re-checks state under the session lock (through the orchestrator, as the
 * SYSTEM actor) and only acts if the condition still holds, so running a job
 * twice is harmless.
 */
@Injectable()
export class QueueJobsService {
  private readonly logger = new Logger(QueueJobsService.name);
  private running = new Set<string>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly orchestrator: QueueOrchestrator,
    private readonly policies: QueuePoliciesService,
    private readonly clock: ClockService,
  ) {}

  /** no-show-marker: booked, not checked in, and past start + max_late_min. */
  @Interval('queue-no-show-marker', 60_000)
  async markNoShows() {
    await this.once('no-show', async () => {
      const rows: { organization_id: string; location_id: string }[] = await this.dataSource.query(
        `SELECT DISTINCT organization_id, location_id FROM appointments
          WHERE status IN ('scheduled', 'confirmed')
            AND start_time < now()
            AND start_time > now() - interval '7 days'`,
      );
      for (const row of rows) {
        const policy = await this.policies.getEffective(row.organization_id, row.location_id);
        const result = await this.dataSource.query(
          `UPDATE appointments
              SET status = 'no_show', no_show_at = now(), updated_at = now()
            WHERE organization_id = $1 AND location_id = $2
              AND status IN ('scheduled', 'confirmed')
              AND start_time + make_interval(mins => $3) < now()`,
          [row.organization_id, row.location_id, policy.maxLateMin],
        );
        const affected = Array.isArray(result) ? result[1] : 0;
        if (affected) this.logger.log(`Marked ${affected} no-show(s) at location ${row.location_id}`);
      }
    });
  }

  /** call-timeout: a CALLED patient who never came is auto-skipped (if the setting is on). */
  @Interval('queue-call-timeout', 15_000)
  async timeoutCalls() {
    await this.once('call-timeout', async () => {
      const rows: {
        id: string;
        version: number;
        called_at: Date;
        organization_id: string;
        location_id: string;
      }[] = await this.dataSource.query(
        `SELECT e.id, e.version, e.called_at, s.organization_id, s.location_id
           FROM queue_entries e
           JOIN queue_sessions s ON s.id = e.queue_session_id
          WHERE e.status = 'called' AND e.called_at < now() - interval '30 seconds'`,
      );
      const now = this.clock.now();
      for (const row of rows) {
        const policy = await this.policies.getEffective(row.organization_id, row.location_id);
        if (!policy.callTimeoutSec) continue;
        if (now.getTime() - new Date(row.called_at).getTime() < policy.callTimeoutSec * 1000) continue;
        await this.orchestrator.timeoutCall(
          { organizationId: row.organization_id, locationId: row.location_id },
          row.id,
          row.version,
        );
      }
    });
  }

  /**
   * session-day-end: sessions from a past service day are closed when empty.
   * Ones with patients still waiting / on hold are left for an admin — never
   * auto-cancelled — and logged as an alert.
   */
  @Interval('queue-session-day-end', 5 * 60_000)
  async closePastSessions() {
    await this.once('day-end', async () => {
      const rows: { id: string; organization_id: string; location_id: string; service_date: string }[] =
        await this.dataSource.query(
          `SELECT id, organization_id, location_id, to_char(service_date, 'YYYY-MM-DD') AS service_date
             FROM queue_sessions
            WHERE status <> 'closed' AND service_date < CURRENT_DATE + 1`,
        );
      const now = this.clock.now();
      for (const row of rows) {
        const policy = await this.policies.getEffective(row.organization_id, row.location_id);
        if (row.service_date >= this.policies.serviceDate(policy, now)) continue;
        const outcome = await this.orchestrator.closeIfEmpty(
          { organizationId: row.organization_id, locationId: row.location_id },
          row.id,
        );
        if (outcome === 'has_patients') {
          this.logger.warn(
            `ALERT: queue session ${row.id} (${row.service_date}) still has patients after the service day ended`,
          );
        }
      }
    });
  }

  /** cleanup: idempotency keys after 24 h, published outbox rows after 7 days. */
  @Cron('15 3 * * *', { name: 'queue-cleanup' })
  async cleanup() {
    await this.dataSource.query(`DELETE FROM idempotency_keys WHERE created_at < now() - interval '24 hours'`);
    await this.dataSource.query(
      `DELETE FROM outbox WHERE published_at IS NOT NULL AND published_at < now() - interval '7 days'`,
    );
  }

  /** One run at a time per job in this process. */
  private async once(name: string, fn: () => Promise<void>) {
    if (this.running.has(name)) return;
    this.running.add(name);
    try {
      await fn();
    } catch (err) {
      this.logger.error(`Queue job ${name} failed: ${(err as Error).message}`);
    } finally {
      this.running.delete(name);
    }
  }
}
