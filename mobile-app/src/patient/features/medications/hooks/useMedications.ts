import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { fetchAllMedications, fetchDoseEvents } from '../api/medications.api';
import { medicationKeys } from '../api/medications.keys';
import { DAY_MS, localDayStart, localYmd } from '../lib/doses';
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
 * Server-known dose events for yesterday … +4 days on the phone's calendar. The key is the first
 * day, so the query is stable within a day and rolls over at midnight.
 */
export function useDoseEvents() {
  const accountId = useAccountId();
  // The window starts yesterday; it rolls over when the app returns to the foreground on a new day.
  const [fromMs, setFromMs] = useState(() => localDayStart(Date.now(), -1));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setFromMs(localDayStart(Date.now(), -1));
    });
    return () => sub.remove();
  }, []);
  const fromYmd = localYmd(fromMs);
  return useQuery({
    queryKey: medicationKeys.doseEvents(accountId, fromYmd),
    queryFn: () => fetchDoseEvents(new Date(fromMs).toISOString(), new Date(fromMs + 6 * DAY_MS).toISOString()),
    enabled: !!accountId,
  });
}

/** Server events plus the not-yet-sent local ones (a local decision wins: it is newer by construction). */
export function useEffectiveDoseEvents(): { events: DoseEvent[]; isLoading: boolean; isError: boolean; refetch: () => void } {
  const server = useDoseEvents();
  const queued = useDoseQueueStore((s) => s.items);
  const events = useMemo(() => [...(server.data ?? []), ...queued], [server.data, queued]);
  return {
    events,
    isLoading: server.isPending && queued.length === 0,
    isError: server.isError,
    refetch: () => void server.refetch(),
  };
}
