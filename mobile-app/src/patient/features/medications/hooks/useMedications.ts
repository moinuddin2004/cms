import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { fetchAllMedications, fetchDoseEvents } from '../api/medications.api';
import { medicationKeys } from '../api/medications.keys';
import { doseEventsWindow } from '../lib/dose-events-cache';
import { useDoseQueueStore } from '../lib/dose-queue';
import type { DoseEvent } from '../types/medications.types';

const useAccountId = (): string | null => usePatientAuthStore((s) => s.account?.id ?? null);

/** Every medicine schedule of the account's family (all statuses; the planner filters). Cached for offline. */
export function useMedications() {
  const accountId = useAccountId();
  return useQuery({
    queryKey: medicationKeys.all(accountId),
    queryFn: fetchAllMedications,
    enabled: !!accountId,
  });
}

/**
 * Server-known dose events from yesterday 00:00 through the end of day +4 on the phone's calendar
 * (`doseEventsWindow`). The key is the first day, so the query is stable within a day and rolls over
 * when the app returns to the foreground on a new day.
 */
export function useDoseEvents() {
  const accountId = useAccountId();
  // The window starts yesterday; it rolls over when the app returns to the foreground on a new day.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNowMs(Date.now());
    });
    return () => sub.remove();
  }, []);
  const { fromMs, toMs, fromYmd } = doseEventsWindow(nowMs);
  return useQuery({
    queryKey: medicationKeys.doseEvents(accountId, fromYmd),
    queryFn: () => fetchDoseEvents(new Date(fromMs).toISOString(), new Date(toMs).toISOString()),
    enabled: !!accountId,
  });
}

/** Server events plus the not-yet-sent local ones (a local decision wins: it is newer by construction). */
export function useEffectiveDoseEvents(): {
  events: DoseEvent[];
  isLoading: boolean;
  /** False only while the FIRST load is really in flight with nothing cached: planning then would ring doses already taken elsewhere (audit L13). Offline / failed / cached all count as settled. */
  settled: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const server = useDoseEvents();
  const queued = useDoseQueueStore((s) => s.items);
  const events = useMemo(() => [...(server.data ?? []), ...queued], [server.data, queued]);
  return {
    events,
    isLoading: server.isPending && queued.length === 0,
    settled: !(server.isPending && server.fetchStatus === 'fetching'),
    /** The server's dose status could not be loaded and none is cached: every dose would look pending. */
    isError: server.isError && !server.data,
    refetch: () => void server.refetch(),
  };
}
