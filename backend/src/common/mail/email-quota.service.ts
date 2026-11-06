import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';

const CACHE_MS = 60_000;

/**
 * Free SMTP plans cap emails per day (Gmail ~500, Brevo 300). `EMAIL_DAILY_CAP`
 * (default 450; 0 = no cap) counts everything sent since 00:00 UTC — account
 * emails (`email_log`) and notification emails (`notification_outbox`).
 * Notification emails over the cap wait for the next day; account emails
 * (verify, reset) are never held.
 */
@Injectable()
export class EmailQuota {
  private cached: { at: number; count: number } | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  get cap(): number {
    const raw = process.env.EMAIL_DAILY_CAP;
    const n = raw === undefined || raw === '' ? 450 : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 450;
  }

  /** Emails sent today (UTC), cached for a minute and bumped locally on each send. */
  async sentToday(): Promise<number> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) {
      return this.cached.count;
    }
    const [row] = await sqlRows<{ n: string }>(
      this.dataSource,
      `SELECT (
         (SELECT count(*) FROM email_log
           WHERE status = 'sent' AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
       + (SELECT count(*) FROM notification_outbox
           WHERE channel = 'email' AND status IN ('sent', 'delivered')
             AND sent_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
       )::text AS n`,
    );
    const count = Number(row?.n ?? 0);
    this.cached = { at: Date.now(), count };
    return count;
  }

  /** True when another notification email may go out today. */
  async hasRoom(): Promise<boolean> {
    if (this.cap === 0) return true;
    return (await this.sentToday()) < this.cap;
  }

  recordSent(): void {
    if (this.cached) this.cached.count += 1;
  }

  /** When held notification emails go out: tomorrow 03:00 UTC (08:00 in Pakistan). */
  nextWindow(now = new Date()): Date {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        3,
      ),
    );
    return d;
  }
}
