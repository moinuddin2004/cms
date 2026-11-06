import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { pgSsl } from 'src/common/database/pg-ssl';
import { OUTBOX_NOTIFY_CHANNEL } from '../services/notification.service';
import { NotificationDispatcher } from './notification-dispatcher.service';

const POLL_MS = 2000;

/**
 * Worker-process loop for the notification outbox (same pattern as the
 * queue's OutboxRelayService): woken by Postgres NOTIFY from the enqueue
 * transaction, with a polling fallback that also picks up retries and
 * quiet-hours rows whose time has come.
 */
@Injectable()
export class NotificationRelayService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(NotificationRelayService.name);
  private timer: NodeJS.Timeout | null = null;
  private listener: Client | null = null;
  private failing = false;

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    await this.listen();
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.listener?.end().catch(() => undefined);
  }

  private async listen() {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) return;
    try {
      this.listener = new Client({
        connectionString: url,
        ssl: pgSsl(),
      });
      this.listener.on('notification', () => void this.tick());
      this.listener.on('error', (err) => {
        this.logger.warn(
          `Notification LISTEN connection lost (${err.message}); polling only`,
        );
        this.listener = null;
      });
      await this.listener.connect();
      await this.listener.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
    } catch (err) {
      this.logger.warn(
        `Notification LISTEN unavailable (${(err as Error).message}); polling only`,
      );
      this.listener = null;
    }
  }

  private async tick() {
    try {
      await this.dispatcher.drain();
      if (this.failing) this.logger.log('Notification relay recovered');
      this.failing = false;
    } catch (err) {
      // Rows stay pending and are retried on the next tick; log once per outage.
      if (!this.failing) {
        this.logger.error(
          `Notification relay failed, will retry: ${(err as Error).message}`,
        );
      }
      this.failing = true;
    }
  }
}
