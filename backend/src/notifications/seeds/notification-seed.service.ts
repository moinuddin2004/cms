import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { NotificationEvent } from '../entities/notification-event.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { placeholdersOf } from '../templates/template-render';
import {
  defaultTemplateSeeds,
  NOTIFICATION_EVENT_SEEDS,
} from './notification-events.seed';

/**
 * On boot: the event catalog and platform default templates,
 * insert-if-missing — except each event's code-owned channel defaults
 * (`email_default`, `channels`), which are kept in step with the seed. One advisory
 * lock so an API and a worker booting together don't both insert.
 */
@Injectable()
export class NotificationSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationSeedService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const created = await this.seed();
    if (created)
      this.logger.log(`Notification seed: ${created} record(s) created`);
  }

  async seed(): Promise<number> {
    return this.dataSource.transaction(async (m) => {
      await m.query(
        `SELECT pg_advisory_xact_lock(hashtext('notification_seed'))`,
      );
      let created = 0;

      const events = m.getRepository(NotificationEvent);
      const existing = new Set(
        (await events.find({ select: ['code'] })).map((e) => e.code),
      );
      const newEvents = NOTIFICATION_EVENT_SEEDS.map((e, i) => ({
        ...e,
        sortOrder: i,
      })).filter((e) => !existing.has(e.code));
      if (newEvents.length) {
        await events.insert(
          newEvents.map((e) => ({
            code: e.code,
            name: e.name,
            description: e.description,
            audiences: e.audiences,
            isMandatoryInternal: e.isMandatoryInternal,
            emailDefault: e.emailDefault ?? false,
            channels: e.channels ?? null,
            variables: e.variables,
            sortOrder: e.sortOrder,
          })),
        );
        created += newEvents.length;
      }
      // Channel defaults are code-owned: keep existing rows in step with the seed.
      for (const e of NOTIFICATION_EVENT_SEEDS) {
        if (!existing.has(e.code)) continue;
        await m.query(
          `UPDATE notification_events
              SET email_default = $2, channels = $3
            WHERE code = $1
              AND (email_default IS DISTINCT FROM $2 OR channels IS DISTINCT FROM $3)`,
          [e.code, e.emailDefault ?? false, e.channels ?? null],
        );
      }

      const templates = m.getRepository(NotificationTemplate);
      const have = new Set(
        (await templates.findBy({ organizationId: IsNull() })).map(
          (t) => `${t.eventCode}:${t.channel}:${t.language}`,
        ),
      );
      const missing = defaultTemplateSeeds().filter(
        (t) => !have.has(`${t.eventCode}:${t.channel}:${t.language}`),
      );
      if (missing.length) {
        await templates.insert(
          missing.map((t) => ({
            ...t,
            organizationId: null,
            providerTemplateRef: null,
            variables: placeholdersOf(t.subject, t.body),
          })),
        );
        created += missing.length;
      }
      return created;
    });
  }
}
