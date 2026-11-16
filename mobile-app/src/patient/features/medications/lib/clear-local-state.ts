import { expoReminderPort } from './expo-reminder-port';
import { useDoseQueueStore } from './dose-queue';
import { cancelAllDoseReminders, runSerialised } from './reminder-scheduler';

/**
 * Patient sign-out: no medicine reminder may keep ringing for an account that left this phone, and
 * the unsent dose queue goes with it (its encrypted copy is wiped with the patient cache).
 */
export async function clearMedicationLocalState(): Promise<void> {
  useDoseQueueStore.getState().reset();
  try {
    await runSerialised(() => cancelAllDoseReminders(expoReminderPort));
  } catch {
    // best effort — the cache wipe is what protects data
  }
}
