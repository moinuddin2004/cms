import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';

import type {
  NotificationItem,
  NotificationListQuery,
  NotificationPage,
  NotificationPrefs,
} from '../types/notifications.types';

export const NOTIFICATIONS_MAX_LIMIT = 50;

/** `GET /me/notifications` — limit is clamped to the server max (50). */
export async function fetchNotifications(q: NotificationListQuery): Promise<NotificationPage> {
  const limit = Math.min(Math.max(q.limit ?? 20, 1), NOTIFICATIONS_MAX_LIMIT);
  const res = await staffApi.get<ApiResponse<NotificationPage>>('/me/notifications', {
    params: { page: q.page, limit, ...(q.unreadOnly ? { unreadOnly: 'true' } : {}) },
  });
  return res.data.data;
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await staffApi.get<ApiResponse<{ count: number }>>('/me/notifications/unread-count');
  return res.data.data.count;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await staffApi.post<ApiResponse<NotificationItem>>(
    `/me/notifications/${encodeURIComponent(id)}/read`,
  );
  return res.data.data;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const res = await staffApi.post<ApiResponse<{ updated: number }>>('/me/notifications/read-all');
  return res.data.data;
}

export async function fetchNotificationPrefs(): Promise<NotificationPrefs> {
  const res = await staffApi.get<ApiResponse<NotificationPrefs>>('/me/notifications/prefs');
  return res.data.data;
}

/** Mobile only ever sends `sound` (email switches are managed on the web). */
export async function putNotificationSound(sound: boolean): Promise<NotificationPrefs> {
  const res = await staffApi.put<ApiResponse<NotificationPrefs>>('/me/notifications/prefs', {
    sound,
  });
  return res.data.data;
}
