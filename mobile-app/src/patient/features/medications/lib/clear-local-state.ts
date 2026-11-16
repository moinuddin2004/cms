import { useDoseQueueStore } from './dose-queue';
import { expoReminderPort } from './expo-reminder-port';
import { cancelAllDoseReminders, runSerialised } from './reminder-scheduler';
import { useReminderSettings } from './reminder-settings';

/**
 * Patient sign-out: no medicine reminder may keep ringing for an account that left this phone, and
 * the unsent dose queue and reminder settings go with it (their encrypted copies are wiped with the
 * patient cache).
 */
export async function clearMedicationLocalState(): Promise<void> {
  useDoseQueueStore.getState().reset();
  useReminderSettings.getState().reset();
  try {
    await runSerialised(() => cancelAllDoseReminders(expoReminderPort));
  } catch {
    // best effort — the cache wipe is what protects data
  }
}
