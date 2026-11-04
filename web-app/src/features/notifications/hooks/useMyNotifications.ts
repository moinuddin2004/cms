import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toastNotificationError } from '../lib/notification-errors'
import { notificationKeys } from '../query-keys'
import { readSoundPref, writeSoundPref } from '../lib/notification-sound'
import { myNotificationsApi } from '../services/notifications.api'
import type { MyNotificationPrefs } from '../types'

/**
 * Fallback only: `notification.new` on the socket refreshes the badge
 * instantly; this catches anything missed while the socket was down.
 */
const UNREAD_POLL_MS = 10 * 60_000

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

/**
 * The user's own switches (notification sound). Starts from the copy kept in
 * this browser so the switch is right before the request returns, and keeps
 * that copy in step with the server.
 */
export function useMyNotificationPrefs() {
  return useQuery({
    queryKey: notificationKeys.mine.prefs,
    queryFn: async () => {
      const prefs = await myNotificationsApi.prefs()
      writeSoundPref(prefs.sound)
      return prefs
    },
    placeholderData: (): MyNotificationPrefs => ({ sound: readSoundPref() }),
    staleTime: 5 * 60_000,
  })
}

export function useUpdateMyNotificationPrefs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<MyNotificationPrefs>) =>
      myNotificationsApi.updatePrefs(body),
    onMutate: (body) => {
      if (typeof body.sound === 'boolean') writeSoundPref(body.sound)
      const previous = queryClient.getQueryData<MyNotificationPrefs>(
        notificationKeys.mine.prefs,
      )
      queryClient.setQueryData<MyNotificationPrefs>(
        notificationKeys.mine.prefs,
        (old) => ({ sound: readSoundPref(), ...old, ...body }),
      )
      return { previous }
    },
    onError: (err, _body, ctx) => {
      if (ctx?.previous) {
        writeSoundPref(ctx.previous.sound)
        queryClient.setQueryData(notificationKeys.mine.prefs, ctx.previous)
      }
      toastNotificationError(err)
    },
    onSuccess: (prefs) => {
      writeSoundPref(prefs.sound)
      queryClient.setQueryData(notificationKeys.mine.prefs, prefs)
    },
  })
}
