import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import {
  MyNotificationsQueryDto,
  UpdateMyNotificationPrefsDto,
} from '../dto/notifications.dto';
import { UserNotificationPref } from '../entities/user-notification-pref.entity';
import { UserNotification } from '../entities/user-notification.entity';
import { notificationError } from '../notification-errors';

/** Personal switches and their defaults (a missing row = the default). */
const PREF_DEFAULTS = { sound: true } as const;
type PrefKey = keyof typeof PREF_DEFAULTS;
export type MyNotificationPrefs = Record<PrefKey, boolean>;

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
  ) {}

  async getPrefs(userId: string): Promise<MyNotificationPrefs> {
    const rows = await this.prefs.findBy({ userId });
    const out: MyNotificationPrefs = { ...PREF_DEFAULTS };
    for (const r of rows) {
      if (r.key in PREF_DEFAULTS) out[r.key as PrefKey] = r.enabled;
    }
    return out;
  }

  async updatePrefs(
    userId: string,
    dto: UpdateMyNotificationPrefsDto,
  ): Promise<MyNotificationPrefs> {
    const changes = (Object.keys(PREF_DEFAULTS) as PrefKey[])
      .filter((key) => typeof dto[key] === 'boolean')
      .map((key) => ({ userId, key, enabled: dto[key] as boolean }));
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
