import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import {
  MyNotificationsQueryDto,
  UpdateMyNotificationPrefsDto,
} from '../dto/notifications.dto';
import { NotificationEvent } from '../entities/notification-event.entity';
import { UserNotificationPref } from '../entities/user-notification-pref.entity';
import {
  emailPrefKey,
  isInternalAudience,
  NotificationChannel,
} from '../notifications.enums';
import { eventChannels } from '../seeds/notification-events.seed';
import { UserNotification } from '../entities/user-notification.entity';
import { notificationError } from '../notification-errors';

/** Personal switches and their defaults (a missing row = the default). */
const PREF_DEFAULTS = { sound: true } as const;
type PrefKey = keyof typeof PREF_DEFAULTS;

/** One event the user may get by email, and their own switch for it. */
export interface MyEmailPref {
  code: string;
  name: string;
  description: string;
  /** Mandatory events always email (when the clinic sends it); the switch is fixed on. */
  mandatory: boolean;
  /** The clinic emails it by default. */
  clinicDefault: boolean;
  enabled: boolean;
}

export type MyNotificationPrefs = Record<PrefKey, boolean> & {
  email: MyEmailPref[];
};

const view = (n: UserNotification) => ({
  id: n.id,
  organizationId: n.organizationId,
  eventCode: n.eventCode,
  title: n.title,
  body: n.body,
  link: n.link,
  readAt: n.readAt,
  createdAt: n.createdAt,
});

/** The signed-in user's in-app inbox (the header bell). Always scoped to that user. */
@Injectable()
export class UserNotificationsService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly repo: Repository<UserNotification>,
    @InjectRepository(UserNotificationPref)
    private readonly prefs: Repository<UserNotificationPref>,
    @InjectRepository(NotificationEvent)
    private readonly events: Repository<NotificationEvent>,
  ) {}

  /** Events a clinic-side user can get by email (internal audience, email allowed). */
  private async emailEvents(): Promise<NotificationEvent[]> {
    const all = await this.events.find({
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
    return all.filter(
      (e) =>
        e.audiences.some(isInternalAudience) &&
        eventChannels({
          audiences: e.audiences.filter(isInternalAudience),
          channels: e.channels,
        }).includes(NotificationChannel.EMAIL),
    );
  }

  async getPrefs(userId: string): Promise<MyNotificationPrefs> {
    const [rows, events] = await Promise.all([
      this.prefs.findBy({ userId }),
      this.emailEvents(),
    ]);
    const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
    const out = { ...PREF_DEFAULTS } as Record<PrefKey, boolean>;
    for (const key of Object.keys(PREF_DEFAULTS) as PrefKey[]) {
      const v = byKey.get(key);
      if (typeof v === 'boolean') out[key] = v;
    }
    return {
      ...out,
      email: events.map((e) => ({
        code: e.code,
        name: e.name,
        description: e.description,
        mandatory: e.isMandatoryInternal,
        clinicDefault: e.emailDefault,
        enabled:
          e.isMandatoryInternal || byKey.get(emailPrefKey(e.code)) !== false,
      })),
    };
  }

  async updatePrefs(
    userId: string,
    dto: UpdateMyNotificationPrefsDto,
  ): Promise<MyNotificationPrefs> {
    const changes = (Object.keys(PREF_DEFAULTS) as PrefKey[])
      .filter((key) => typeof dto[key] === 'boolean')
      .map((key): { userId: string; key: string; enabled: boolean } => ({
        userId,
        key,
        enabled: dto[key] as boolean,
      }));
    if (dto.email) {
      const events = new Map((await this.emailEvents()).map((e) => [e.code, e]));
      for (const [code, enabled] of Object.entries(dto.email)) {
        const event = events.get(code);
        if (!event || typeof enabled !== 'boolean') {
          throw notificationError(
            'NOTIFICATION_EVENT_UNKNOWN',
            `No email to switch for "${code}"`,
          );
        }
        if (event.isMandatoryInternal && !enabled) {
          throw notificationError(
            'NOTIFICATION_RULE_LOCKED',
            `${event.name} is required by your clinic and cannot be switched off`,
          );
        }
        changes.push({ userId, key: emailPrefKey(code), enabled });
      }
    }
    if (changes.length) await this.prefs.upsert(changes, ['userId', 'key']);
    return this.getPrefs(userId);
  }

  async list(userId: string, q: MyNotificationsQueryDto) {
    const [rows, total] = await this.repo.findAndCount({
      where: { userId, ...(q.unreadOnly ? { readAt: IsNull() } : {}) },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return PaginatedResponseDto.create(rows.map(view), total, q.page, q.limit);
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return { count: await this.repo.countBy({ userId, readAt: IsNull() }) };
  }

  async markRead(userId: string, id: string) {
    const row = await this.repo.findOneBy({ id, userId });
    if (!row)
      throw notificationError(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
      );
    if (!row.readAt) {
      row.readAt = new Date();
      await this.repo.update({ id, userId }, { readAt: row.readAt });
    }
    return view(row);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.repo.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }
}
