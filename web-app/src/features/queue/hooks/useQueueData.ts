import { useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import {
  fetchDisplayState,
  fetchMySession,
  fetchPatientVisits,
  fetchQueueBoard,
  fetchQueuePolicies,
  fetchSessionSnapshot,
} from '../services/queue.api'
import { useQueueSocket } from './useQueueSocket'
import type { QueueSocketEvent } from './useQueueSocket'

export const QUEUE_KEY = 'queue'

/** Poll this often only while the realtime socket is down. */
const FALLBACK_POLL_MS = 10_000

/**
 * Refetch when an event is newer than what we hold. `known(sessionId)` is the
 * session's eventSeq from the last snapshot; older or duplicate seqs (the
 * relay is at-least-once) are ignored. Refetches are coalesced.
 */
function useSeqRefetch(
  known: (sessionId: string) => number | undefined,
  refetch: () => void,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (e: QueueSocketEvent) => {
      const have = known(e.sessionId)
      if (have !== undefined && e.seq <= have) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(refetch, 120)
    },
    [known, refetch],
  )
}

/**
 * While the socket is down, refresh `queryKey` every 10 s instead. When it
 * (re)connects, refetch once: events between the last poll and the room
 * subscription were not delivered to us.
 */
function useFallbackPoll(queryKey: unknown[], enabled: boolean) {
  const queryClient = useQueryClient()
  const wasPolling = useRef(enabled)
  const key = JSON.stringify(queryKey)
  useEffect(() => {
    if (wasPolling.current && !enabled) {
      void queryClient.invalidateQueries({ queryKey, exact: true })
    }
    wasPolling.current = enabled
  }, [enabled, key, queryClient]) // `key` stands in for queryKey
  useQuery({
    queryKey: [...queryKey, 'fallback-poll'],
    queryFn: async () => {
      await queryClient.invalidateQueries({ queryKey, exact: true })
      return Date.now()
    },
    enabled,
    refetchInterval: FALLBACK_POLL_MS,
  })
}

/** Reception board — every doctor's lane at the active location, live. */
export function useQueueBoard(date?: string) {
  const locationId = useAuthStore((s) => s.activeLocationId)
  const queryClient = useQueryClient()
  const queryKey = [QUEUE_KEY, 'board', locationId, date ?? 'today']

  const query = useQuery({
    queryKey,
    queryFn: () => fetchQueueBoard(date),
    enabled: !!locationId,
    placeholderData: (prev) => prev,
  })

  const known = useCallback(
    (sessionId: string) => {
      const lane = query.data?.lanes.find(
        (l) => l.snapshot?.session.id === sessionId,
      )
      return lane?.snapshot?.session.eventSeq
    },
    [query.data],
  )
  const onEvent = useSeqRefetch(known, () =>
    queryClient.invalidateQueries({ queryKey }),
  )
  const { connected } = useQueueSocket(
    locationId ? [`location:${locationId}:board`] : [],
    onEvent,
  )

  useFallbackPoll(queryKey, !!locationId && !connected)

  return { ...query, live: connected }
}

/** One doctor's session snapshot, live. */
export function useSessionSnapshot(sessionId: string | null | undefined) {
  const queryClient = useQueryClient()
  const queryKey = [QUEUE_KEY, 'session', sessionId]
  const query = useQuery({
    queryKey,
    queryFn: () => fetchSessionSnapshot(sessionId!),
    enabled: !!sessionId,
    placeholderData: (prev) => prev,
  })
  const known = useCallback(() => query.data?.session.eventSeq, [query.data])
  const onEvent = useSeqRefetch(known, () =>
    queryClient.invalidateQueries({ queryKey }),
  )
  const { connected } = useQueueSocket(
    sessionId ? [`session:${sessionId}`] : [],
    onEvent,
  )
  useFallbackPoll(queryKey, !!sessionId && !connected)
  return { ...query, live: connected }
}

/** The signed-in doctor's own queue for today, live. */
export function useMySession(doctorId?: string, enabled = true) {
  const queryClient = useQueryClient()
  const queryKey = [QUEUE_KEY, 'my-session', doctorId ?? 'me']
  const query = useQuery({
    queryKey,
    queryFn: () => fetchMySession(doctorId),
    enabled,
    retry: false,
    placeholderData: (prev) => prev,
  })
  const sessionId = query.data?.session.id
  const known = useCallback(() => query.data?.session.eventSeq, [query.data])
  const onEvent = useSeqRefetch(known, () =>
    queryClient.invalidateQueries({ queryKey }),
  )
  const { connected } = useQueueSocket(
    sessionId ? [`session:${sessionId}`] : [],
    onEvent,
  )

  useFallbackPoll(queryKey, !!sessionId && !connected)

  return { ...query, live: connected }
}

/** TV display state (public, no login), live via the display room. */
export function useDisplayState(locationId: string) {
  const queryClient = useQueryClient()
  const queryKey = [QUEUE_KEY, 'display', locationId]
  const query = useQuery({
    queryKey,
    queryFn: () => fetchDisplayState(locationId),
    placeholderData: (prev) => prev,
  })
  const seqs = useRef(new Map<string, number>())
  const onEvent = useCallback(
    (e: QueueSocketEvent) => {
      const have = seqs.current.get(e.sessionId) ?? 0
      if (e.seq <= have) return
      seqs.current.set(e.sessionId, e.seq)
      queryClient.invalidateQueries({ queryKey })
    },
    [queryClient, locationId],
  )
  const { connected } = useQueueSocket(
    [`location:${locationId}:display`],
    onEvent,
    {
      anonymous: true,
    },
  )

  useFallbackPoll(queryKey, !connected)

  return { ...query, live: connected }
}

export function useQueuePolicies() {
  const locationId = useAuthStore((s) => s.activeLocationId)
  return useQuery({
    queryKey: [QUEUE_KEY, 'policies', locationId],
    queryFn: fetchQueuePolicies,
    enabled: !!locationId,
  })
}

export function usePatientVisits(patientId: string) {
  return useQuery({
    queryKey: [QUEUE_KEY, 'visits', patientId],
    queryFn: () => fetchPatientVisits(patientId),
    enabled: !!patientId,
  })
}
