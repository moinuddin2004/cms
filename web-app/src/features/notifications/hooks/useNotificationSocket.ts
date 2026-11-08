import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import {
  playNotificationChime,
  unlockNotificationSound,
} from '../lib/notification-sound'
import { notificationKeys } from '../query-keys'
import type { NotificationNewEvent } from '../types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

/**
 * Instant bell updates: the API puts every authenticated `/realtime` socket in
 * its user's room and emits `notification.new` there. On each one: refresh
 * the badge + list, show a toast and play the chime (if switched on). After a
 * reconnect the badge is refetched, since events may have been missed.
 *
 * A notification from a clinic other than the active one is toasted with
 * that clinic's name but no "Open" (its link belongs to the other clinic).
 * Mounted once per shell, by `NotificationBell`.
 */
export function useNotificationSocket(enabled = true) {
  const token = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const latest = useRef({ navigate })
  latest.current = { navigate }

  useEffect(() => {
    if (!enabled || !token) return
    unlockNotificationSound()

    // Loaded on first use so socket.io stays out of the initial bundle.
    let socket: Socket | null = null
    let cancelled = false

    void import('socket.io-client').then(({ io }) => {
      if (cancelled) return
      const s = io(`${API_BASE_URL}/realtime`, {
        auth: { token },
        transports: ['websocket'],
        reconnectionDelayMax: 10_000,
      })
      socket = s
      let connectedBefore = false
      s.on('connect', () => {
        if (connectedBefore) {
          void queryClient.invalidateQueries({
            queryKey: notificationKeys.mine.all,
          })
        }
        connectedBefore = true
      })
      s.on('notification.new', (e: NotificationNewEvent) => {
        void queryClient.invalidateQueries({
          queryKey: notificationKeys.mine.all,
        })

        const { activeOrganizationId, accessibleOrganizations } =
          useAuthStore.getState()
        const sameClinic =
          !activeOrganizationId || activeOrganizationId === e.organizationId
        const otherClinic = sameClinic
          ? null
          : accessibleOrganizations.find((o) => o.id === e.organizationId)?.name

        toast(e.title || 'New notification', {
          id: `notification-${e.id}`,
          description: otherClinic ? `${otherClinic} · ${e.body}` : e.body,
          action:
            sameClinic && e.link
              ? {
                  label: 'Open',
                  onClick: () => void latest.current.navigate({ to: e.link! }),
                }
              : undefined,
        })
        void playNotificationChime(e.id)
      })
    })

    return () => {
      cancelled = true
      socket?.removeAllListeners()
      socket?.disconnect()
    }
  }, [enabled, token, queryClient])
}
