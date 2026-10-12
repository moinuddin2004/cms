import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { REALTIME_PUBLISHER, RealtimePublisher } from './realtime-bus';

const BATCH = 100;
const FALLBACK_POLL_MS = 1000;

/**
 * Outbox relay (worker process): hands committed `outbox` rows to the
 * realtime publisher — Redis, fanned out to every API instance's sockets, or
 * the local gateway in single-process mode — and stamps `published_at` only
 * once that succeeded. If Redis is down the batch rolls back and is retried.
 * Woken by Postgres NOTIFY (`queue_outbox`, sent in the same transaction as
 * the change) with a 1-second polling fallback. `FOR UPDATE SKIP LOCKED`
 * keeps a second relay safe; delivery is at-least-once and clients drop
 * duplicates by `seq`.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | null = null;
  private listener: Client | null = null;
  private draining = false;
  private again = false;
  private failing = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REALTIME_PUBLISHER) private readonly publisher: RealtimePublisher,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    this.timer = setInterval(() => void this.drain(), FALLBACK_POLL_MS);
    await this.listen();
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.listener?.end().catch(() => undefined);
  }

  /** Direct connection for LISTEN (a pooled/transaction-mode connection can't hold it). */
  private async listen() {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) return;
    try {
      this.listener = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
      this.listener.on('notification', () => void this.drain());
      this.listener.on('error', (err) => {
        this.logger.warn(`Outbox LISTEN connection lost (${err.message}); polling only`);
        this.listener = null;
      });
      await this.listener.connect();
      await this.listener.query('LISTEN queue_outbox');
    } catch (err) {
      this.logger.warn(`Outbox LISTEN unavailable (${(err as Error).message}); polling only`);
      this.listener = null;
    }
  }

  async drain(): Promise<void> {
    if (this.draining) {
      this.again = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.again = false;
        let count = 0;
        await this.dataSource.transaction(async (manager) => {
          const rows: { id: string; topic: string; payload: Record<string, unknown> }[] =
            await manager.query(
              `SELECT id, topic, payload FROM outbox
                WHERE published_at IS NULL
                ORDER BY id
                LIMIT ${BATCH}
                FOR UPDATE SKIP LOCKED`,
            );
          count = rows.length;
          if (!count) return;
          await this.publisher.publish(rows.map((r) => ({ topic: r.topic, payload: r.payload })));
          await manager.query(`UPDATE outbox SET published_at = now() WHERE id = ANY($1::bigint[])`, [
            rows.map((r) => r.id),
          ]);
        });
        if (count === BATCH) this.again = true;
      } while (this.again);
      if (this.failing) this.logger.log('Outbox relay recovered');
      this.failing = false;
    } catch (err) {
      // Rows stay unpublished and are retried every second; log once per outage.
      if (!this.failing) this.logger.error(`Outbox relay failed, will retry: ${(err as Error).message}`);
      this.failing = true;
    } finally {
      this.draining = false;
    }
  }
}
