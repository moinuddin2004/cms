import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useOnline } from '@/core/network';
import { getPermissionState } from '@/core/notifications/permissions';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { useEffectiveDoseEvents, useMedications } from '../hooks/useMedications';
import { useReminderProfiles } from '../hooks/useReminderProfiles';
import { flushDoseQueue, useDoseQueueStore } from '../lib/dose-queue';
import { expoReminderPort } from '../lib/expo-reminder-port';
import { planReminders } from '../lib/plan-reminders';
import { buildReminderContent } from '../lib/reminder-content';
import { useReminderSettings } from '../lib/reminder-settings';
import { runSerialised, syncReminders, toScheduled } from '../lib/reminder-scheduler';
import { useLocale } from '../hooks/useLocale';

/**
 * Renders nothing. Mounted once in the signed-in patient layout (docs/02 §2) it
 * - keeps the OS's pending dose reminders equal to the plan: on start, on returning to the app and
 *   whenever the schedules / dose events / settings change (the cached copy is enough, so this works
 *   with no network at all),
 * - flushes the offline dose-action queue when the phone is online, back in the foreground, or a
 *   decision was just made.
 * Reminders are local notifications: once scheduled they ring in airplane mode, with the app closed.
 */
export function ReminderSync() {
  const queryClient = useQueryClient();
  const accountId = usePatientAuthStore((s) => s.account?.id ?? null);
  const online = useOnline();
  const schedules = useMedications();
  const { events } = useEffectiveDoseEvents();
  const profiles = useReminderProfiles();
  const privateReminders = useReminderSettings((s) => s.privateReminders);
  const queued = useDoseQueueStore((s) => s.items.length);
  const locale = useLocale();
  // Bumped on every return to the foreground: "now" moved, so the plan must be recomputed.
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // --- offline dose queue -------------------------------------------------
  useEffect(() => {
    if (accountId) void useDoseQueueStore.getState().hydrate(accountId);
  }, [accountId]);

  useEffect(() => {
    if (!accountId || !online || queued === 0) return;
    void flushDoseQueue().then((sent) => {
      if (sent) void queryClient.invalidateQueries({ queryKey: ['dose-events'] });
    });
  }, [accountId, online, queued, foregroundTick, queryClient]);

  // --- reminder plan ------------------------------------------------------
  const scheduleData = schedules.data;

  useEffect(() => {
    if (!scheduleData) return; // schedules not known yet: leave what is scheduled alone
    // "now" is read here, not during render; `foregroundTick` re-runs this with a fresh one.
    const plan = planReminders(scheduleData, events, Date.now(), undefined, undefined, {
      isPrivate: () => privateReminders,
      profileName: profiles.nameOf,
    });
    let cancelled = false;
    void (async () => {
      if ((await getPermissionState()) !== 'granted' || cancelled) return;
      await runSerialised(() => syncReminders(expoReminderPort, toScheduled(plan, (r) => buildReminderContent(r))));
    })();
    return () => {
      cancelled = true;
    };
    // `locale` is a dependency on purpose: the lock-screen text is in the app language.
  }, [scheduleData, events, privateReminders, profiles, foregroundTick, locale]);

  return null;
}
