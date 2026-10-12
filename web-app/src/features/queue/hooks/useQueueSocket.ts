import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/useAuthStore'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export interface QueueSocketEvent {
  type: 'queue.event' | 'display.event'
  sessionId: string
  seq: number
  eventType: string
  entryId?: string | null
  fromStatus?: string | null
  toStatus?: string | null
}

/**
 * Subscribe to queue rooms on the `/realtime` socket and get each event.
 * Events are nudges carrying `seq`; callers compare it with their snapshot's
 * `eventSeq` and refetch when it is newer (duplicates/old seqs are ignored).
 *
 * Returns `connected` (true once every room's subscribe is acknowledged) so
 * callers can fall back to polling while the socket — or the Redis/worker
 * behind it; the API refuses sockets then — is down, and refetch when it
 * comes back. Data is never lost, only later.
 * `anonymous` connects without a token (TV display rooms only).
 */
export function useQueueSocket(
  rooms: string[],
  onEvent: (event: QueueSocketEvent) => void,
  { anonymous = false }: { anonymous?: boolean } = {},
): { connected: boolean } {
  const token = useAuthStore((s) => s.accessToken)
  const [connected, setConnected] = useState(false)
  const handler = useRef(onEvent)
  handler.current = onEvent
  const roomKey = rooms.filter(Boolean).sort().join('|')

  useEffect(() => {
    const wanted = roomKey ? roomKey.split('|') : []
    if (!wanted.length || (!anonymous && !token)) return

    const socket: Socket = io(`${API_BASE_URL}/realtime`, {
      auth: anonymous ? {} : { token },
      transports: ['websocket'],
      reconnectionDelayMax: 10_000,
    })
    const subscribeAll = () =>
      Promise.all(
        wanted.map(
          (room) =>
            new Promise((resolve) =>
              socket.emit('subscribe', { room }, resolve),
            ),
        ),
      )
    socket.on('connect', () => {
      void subscribeAll().then(() => {
        if (socket.connected) setConnected(true)
      })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))
    socket.on('queue.event', (e: QueueSocketEvent) => handler.current(e))
    socket.on('display.event', (e: QueueSocketEvent) => handler.current(e))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      setConnected(false)
    }
  }, [roomKey, token, anonymous])

  return { connected }
}
