import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useOnline } from '@/core/network';
import { getPermissionState } from '@/core/notifications/permissions';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { useLocale } from '../hooks/useLocale';
import { useEffectiveDoseEvents, useMedications } from '../hooks/useMedications';
import { useNotificationPermission } from '../hooks/useNotificationPermission';
import { useReminderProfiles } from '../hooks/useReminderProfiles';
import { flushDoseQueue, useDoseQueueStore } from '../lib/dose-queue';
import { expoReminderPort } from '../lib/expo-reminder-port';
import { planReminders } from '../lib/plan-reminders';
import { buildReminderContent } from '../lib/reminder-content';
import { runSerialised, syncReminders, toScheduled } from '../lib/reminder-scheduler';
import { useReminderSettings } from '../lib/reminder-settings';

/**
 * Renders nothing. Mounted once in the signed-in patient layout (docs/02 §2) it
 * - keeps the OS's pending dose reminders equal to the plan: on start, on returning to the app,
 *   when the notification permission is granted and whenever the schedules / dose events / settings
 *   change (the persisted cache is enough, so this works with no network at all),
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
  const permission = useNotificationPermission();
  const settingsReady = useReminderSettings((s) => s.hydrated);
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

  // --- per-account local state ---------------------------------------------
  useEffect(() => {
    if (!accountId) return;
    void useDoseQueueStore.getState().hydrate(accountId);
    void useReminderSettings.getState().hydrate(accountId);
  }, [accountId]);

  // --- offline dose queue --------------------------------------------------
  useEffect(() => {
    if (!accountId || !online || queued === 0) return;
    void flushDoseQueue(queryClient).then((sent) => {
      if (sent) void queryClient.invalidateQueries({ queryKey: ['dose-events'] });
    });
  }, [accountId, online, queued, foregroundTick, queryClient]);

  // --- reminder plan ---------------------------------------------------------
  const scheduleData = schedules.data;

  useEffect(() => {
    // Not known yet (schedules, or the private-reminders choice): leave what is scheduled alone.
    if (!accountId || !scheduleData || !settingsReady) return;
    // "now" is read here, not during render; `foregroundTick` re-runs this with a fresh one.
    const plan = planReminders(scheduleData, events, Date.now(), undefined, undefined, {
      isPrivate: () => privateReminders,
      profileName: profiles.nameOf,
    });
    let cancelled = false;
    void runSerialised(async () => {
      // Re-checked inside the serialised task: it may have waited behind another pass while the
      // data changed, the account signed out or the permission was revoked.
      if (cancelled || usePatientAuthStore.getState().account?.id !== accountId) return;
      if ((await getPermissionState()) !== 'granted') return;
      if (cancelled || usePatientAuthStore.getState().account?.id !== accountId) return;
      await syncReminders(expoReminderPort, toScheduled(plan, (r) => buildReminderContent(r)));
    });
    return () => {
      cancelled = true;
    };
    // `locale` is a dependency on purpose (the text is in the app language); `permission.state`
    // re-plans right after the user grants notifications.
  }, [accountId, scheduleData, events, settingsReady, privateReminders, profiles, foregroundTick, locale, permission.state]);

  return null;
}
