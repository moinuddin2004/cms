/**
 * Query keys for the notifications feature. Always start with `'notifications'`
 * so `notificationKeys.all` covers the inbox list and the unread count.
 * Realtime (`notification.new`) invalidates `all`; M1-13 builds the queries on these.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => ['notifications', 'list'] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
};
