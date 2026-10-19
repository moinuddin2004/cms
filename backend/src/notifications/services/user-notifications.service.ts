import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { MyNotificationsQueryDto } from '../dto/notifications.dto';
import { UserNotification } from '../entities/user-notification.entity';
import { notificationError } from '../notification-errors';

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
  ) {}

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
