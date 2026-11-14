import type { Paginated } from '@/core/types';

/** `GET /me/notifications` row (verified: user-notifications.service.ts `view`). */
export interface NotificationItem {
  id: string;
  organizationId: string;
  eventCode: string;
  title: string;
  body: string;
  /** In-app link such as `/queue/doctor` or `/patients/<id>`; may be null or unknown to the app. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export type NotificationPage = Paginated<NotificationItem>;

export interface NotificationListQuery {
  page: number;
  /** Server max 50. */
  limit?: number;
  unreadOnly?: boolean;
}

/** One per-event email switch. Mobile does not show these; typed so a PUT round-trip stays lossless. */
export interface NotificationEmailPref {
  code: string;
  name: string;
  description: string;
  mandatory: boolean;
  clinicDefault: boolean;
  enabled: boolean;
}

export interface NotificationPrefs {
  sound: boolean;
  email: NotificationEmailPref[];
}
