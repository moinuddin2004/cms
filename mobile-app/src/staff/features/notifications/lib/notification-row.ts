import { formatDateTime } from '@/staff/lib/datetime';

import type { NotificationItem } from '../types/notifications.types';

export interface NotificationRowModel {
  title: string;
  body: string;
  /** Clinic-clock time (the ACTIVE location's clock, also for other-clinic rows), e.g. "Nov 14, 2026, 3:05 PM". */
  time: string;
  unread: boolean;
  /** Clinic name when the row belongs to another clinic than the active one, else null. */
  otherClinic: string | null;
}

/**
 * View model of one inbox row. `orgNames` maps organizationId → clinic name; an unknown
 * other clinic falls back to a neutral label so the switch prompt still has a name.
 */
export function describeNotification(
  n: NotificationItem,
  activeOrgId: string | null,
  orgNames: Record<string, string>,
): NotificationRowModel {
  const other = n.organizationId !== activeOrgId;
  return {
    title: n.title,
    body: n.body,
    time: formatDateTime(n.createdAt),
    unread: n.readAt === null,
    otherClinic: other ? (orgNames[n.organizationId] ?? 'Another clinic') : null,
  };
}
