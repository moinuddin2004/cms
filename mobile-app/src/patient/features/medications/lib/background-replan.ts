import { QUERY_CACHE_KEY } from '@/core/storage/query-persister';
import { openSecureCache } from '@/core/storage/secure-cache';
import { getPermissionState } from '@/core/notifications/permissions';
import { getRefreshToken } from '@/patient/lib/session';

import { expoReminderPort } from './expo-reminder-port';
import { mergeDoseEvents } from './dose-events-cache';
import { planReminders } from './plan-reminders';
import { runSerialised, syncReminders } from './reminder-scheduler';
import { buildScheduledReminders } from './reminder-window';
import type { DoseEvent, MedicationSchedule } from '../types/medications.types';

/**
 * Re-plan the reminders WITHOUT the patient space being mounted (audit H3): the shell calls this on
 * start and on every return to the foreground while the staff space (or no space) is active, so a
 * clinician who is also a patient keeps a topped-up 72 h window — and a schedule changed or stopped
 * since is picked up the next time the app opens. It reads only the phone's own encrypted cache
 * (the persisted `medications` / `dose-events` queries, the unsent dose queue, the private-reminders
 * choice): no network, no patient token.
 */
export interface CacheReader {
  getString: (key: string) => string | undefined;
}

export interface PersistedPlanInput {
  accountId: string;
  schedules: MedicationSchedule[];
  events: DoseEvent[];
  privateReminders: boolean;
}

interface PersistedQuery {
  queryKey?: unknown[];
  state?: { data?: unknown };
}

const parse = <T>(raw: string | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** Pure: what the planner needs, read out of the encrypted cache; `null` when there is nothing to plan from. */
export function readPersistedPlanInput(cache: CacheReader): PersistedPlanInput | null {
  const client = parse<{ clientState?: { queries?: PersistedQuery[] } }>(cache.getString(QUERY_CACHE_KEY));
  const queries = client?.clientState?.queries ?? [];
  const meds = queries.find((q) => q.queryKey?.[0] === 'medications' && Array.isArray(q.state?.data));
  const accountId = meds?.queryKey?.[1];
  if (!meds || typeof accountId !== 'string') return null;

  let events: DoseEvent[] = [];
  for (const q of queries) {
    if (q.queryKey?.[0] === 'dose-events' && q.queryKey[1] === accountId && Array.isArray(q.state?.data)) {
      events = mergeDoseEvents(events, q.state.data as DoseEvent[]);
    }
  }
  const queued = parse<DoseEvent[]>(cache.getString(`doseQueue:${accountId}`));
  if (Array.isArray(queued)) events = mergeDoseEvents(events, queued);

  const settings = parse<{ private?: boolean }>(cache.getString(`reminderSettings:${accountId}`));
  return {
    accountId,
    schedules: meds.state!.data as MedicationSchedule[],
    events,
    privateReminders: settings?.private === true,
  };
}

/** Never throws; does nothing without a patient session, a cached schedule list or notification permission. */
export async function replanRemindersFromCache(): Promise<void> {
  try {
    if (!(await getRefreshToken())) return; // no patient session on this phone
    const input = readPersistedPlanInput(await openSecureCache('patient'));
    if (!input) return;
    if ((await getPermissionState()) !== 'granted') return;
    const now = Date.now();
    const plan = planReminders(input.schedules, input.events, now, undefined, undefined, {
      isPrivate: () => input.privateReminders,
    });
    await runSerialised(async () => {
      // The session may have ended while this waited behind another pass.
      if (!(await getRefreshToken())) return;
      await syncReminders(expoReminderPort, buildScheduledReminders(plan, now));
    });
  } catch {
    // best effort: the next start / foreground tries again
  }
}
