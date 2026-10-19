import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toastNotificationError } from '../lib/notification-errors'
import { notificationKeys } from '../query-keys'
import { myNotificationsApi } from '../services/notifications.api'

/** Polled: the bell's badge stays fresh without a socket. */
const UNREAD_POLL_MS = 30_000

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.mine.unread,
    queryFn: myNotificationsApi.unreadCount,
    enabled,
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useMyNotifications(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.mine.list,
    queryFn: () => myNotificationsApi.list({ limit: 20 }),
    enabled,
  })
}

function useInboxMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onError: toastNotificationError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.mine.all }),
  })
}

export const useMarkNotificationRead = () =>
  useInboxMutation((id: string) => myNotificationsApi.markRead(id))

export const useMarkAllNotificationsRead = () =>
  useInboxMutation((_: void) => myNotificationsApi.markAllRead())
