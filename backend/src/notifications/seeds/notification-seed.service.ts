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
 * insert-if-missing only (existing rows are never touched). One advisory
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
            variables: e.variables,
            sortOrder: e.sortOrder,
          })),
        );
        created += newEvents.length;
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
