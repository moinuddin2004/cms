import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { apiErrorMessage } from '@/core/http/api-error';

import {
  fetchNotificationPrefs,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  putNotificationSound,
} from '../api/notifications.api';
import { notificationKeys } from '../api/notifications.keys';
import type { NotificationPage, NotificationPrefs } from '../types/notifications.types';

const PAGE_SIZE = 20;

/** Unread badge count. Realtime `notification.new` invalidates `notificationKeys.all`. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    staleTime: 0,
  });
}

/** Inbox pages, newest first. Next page while `page < totalPages`. */
export function useNotificationsInfinite(opts: { unreadOnly?: boolean } = {}) {
  const unreadOnly = opts.unreadOnly ?? false;
  return useInfiniteQuery({
    queryKey: notificationKeys.inbox(unreadOnly),
    queryFn: ({ pageParam }) => fetchNotifications({ page: pageParam, limit: PAGE_SIZE, unreadOnly }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: 0,
  });
}

type ListCache = InfiniteData<NotificationPage, number>;

/** Is this row currently cached as unread? Looks in every cached inbox list. */
function isCachedUnread(client: QueryClient, id: string): boolean {
  for (const [, data] of client.getQueriesData<ListCache>({ queryKey: notificationKeys.list() })) {
    for (const page of data?.pages ?? []) {
      const row = page.data.find((n) => n.id === id);
      if (row) return row.readAt === null;
    }
  }
  return false;
}

/** Marks one notification read. Optimistic: row read + unread count −1; both roll back on error. */
export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: notificationKeys.all });
      const lists = client.getQueriesData<ListCache>({ queryKey: notificationKeys.list() });
      const count = client.getQueryData<number>(notificationKeys.unreadCount());
      const wasUnread = isCachedUnread(client, id);
      const readAt = new Date().toISOString();
      client.setQueriesData<ListCache>({ queryKey: notificationKeys.list() }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                data: p.data.map((n) => (n.id === id && n.readAt === null ? { ...n, readAt } : n)),
              })),
            }
          : old,
      );
      if (wasUnread && typeof count === 'number') {
        client.setQueryData<number>(notificationKeys.unreadCount(), Math.max(0, count - 1));
      }
      return { lists, count };
    },
    onError: (err, _id, ctx) => {
      for (const [key, data] of ctx?.lists ?? []) client.setQueryData(key, data);
      if (ctx && ctx.count !== undefined) {
        client.setQueryData(notificationKeys.unreadCount(), ctx.count);
      }
      toast.error(apiErrorMessage(err, 'Could not mark as read.'));
    },
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** Marks everything read, then refetches the list and the count. */
export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not mark all as read.')),
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: notificationKeys.prefs(),
    queryFn: fetchNotificationPrefs,
  });
}

/** Sets the notification sound. Optimistic; rolls back on error. */
export function useSetNotificationSound() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sound: boolean) => putNotificationSound(sound),
    onMutate: async (sound) => {
      await client.cancelQueries({ queryKey: notificationKeys.prefs() });
      const previous = client.getQueryData<NotificationPrefs>(notificationKeys.prefs());
      if (previous) client.setQueryData(notificationKeys.prefs(), { ...previous, sound });
      return { previous };
    },
    onError: (err, _sound, ctx) => {
      if (ctx?.previous) client.setQueryData(notificationKeys.prefs(), ctx.previous);
      toast.error(apiErrorMessage(err, 'Could not save the sound setting.'));
    },
    onSuccess: (prefs) => client.setQueryData(notificationKeys.prefs(), prefs),
  });
}
