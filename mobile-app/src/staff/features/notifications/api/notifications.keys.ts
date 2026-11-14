/**
 * Query keys for the notifications feature. Always start with `'notifications'`
 * so `notificationKeys.all` covers the inbox list, the unread count and the prefs.
 * Realtime (`notification.new`) invalidates `all`. The inbox belongs to the user and spans every
 * clinic, so (unlike clinical data) these keys carry no org/location.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  /** Prefix of every inbox list (any filter). */
  list: () => ['notifications', 'list'] as const,
  inbox: (unreadOnly = false) => ['notifications', 'list', { unreadOnly }] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  prefs: () => ['notifications', 'prefs'] as const,
};
