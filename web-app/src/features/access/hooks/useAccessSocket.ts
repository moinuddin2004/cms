import { useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/useAuthStore'
import type { AccessChangedEvent } from '../types/access.types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

/** Org-wide room the API emits `access.changed` into. */
export const accessRoom = (orgId: string) => `org:${orgId}`

/**
 * Listen for `access.changed` on the `/realtime` socket (same handshake and
 * `subscribe` ack as the queue screens) and call `onChange` for the active
 * org. Also calls it after a reconnect, since events may have been missed
 * while the socket was down. If the room is refused, the caller's
 * refetch-on-focus keeps access fresh, only later.
 */
export function useAccessSocket(
  orgId: string | null,
  onChange: (event: AccessChangedEvent | null) => void,
  enabled = true,
) {
  const token = useAuthStore((s) => s.accessToken)
  const handler = useRef(onChange)
  handler.current = onChange

  useEffect(() => {
    if (!enabled || !orgId || !token) return

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
        s.emit('subscribe', { room: accessRoom(orgId) }, () => {
          if (connectedBefore) handler.current(null)
          connectedBefore = true
        })
      })
      s.on('access.changed', (e: AccessChangedEvent) => {
        if (e.organizationId === orgId) handler.current(e)
      })
    })

    return () => {
      cancelled = true
      socket?.removeAllListeners()
      socket?.disconnect()
    }
  }, [orgId, token, enabled])
}
