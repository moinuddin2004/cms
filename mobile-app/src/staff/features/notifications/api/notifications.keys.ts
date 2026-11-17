/**
 * Query keys for the notifications feature. Always start with `'notifications'`
 * so `notificationKeys.all` covers the inbox list, the unread count and the prefs.
 * Realtime (`notification.new`) invalidates `all`. The inbox belongs to the user and spans every
 * clinic, so (unlike clinical data) these keys carry no org/location — they carry the USER id
 * instead (last element, so the prefixes below still match): on a shared tablet a stale cache of
 * the previous user can never answer for the next one (audit M1).
 */
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

const userScope = () => useStaffAuthStore.getState().user?.uuid ?? null;

export const notificationKeys = {
  all: ['notifications'] as const,
  /** Prefix of every inbox list (any filter, any user). */
  list: () => ['notifications', 'list'] as const,
  inbox: (unreadOnly = false, userId: string | null = userScope()) =>
    ['notifications', 'list', { unreadOnly }, userId] as const,
  unreadCount: (userId: string | null = userScope()) =>
    ['notifications', 'unread-count', userId] as const,
  prefs: (userId: string | null = userScope()) => ['notifications', 'prefs', userId] as const,
};
