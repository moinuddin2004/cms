import { create } from 'zustand';

import { openSecureCache } from '@/core/storage/secure-cache';

/**
 * "Private reminders" (docs/03 §5): the lock screen shows "Medicine reminder for Ali" instead of the
 * medicine. The choice belongs to the ACCOUNT, so it is kept in that account's encrypted patient
 * cache (never in the shared prefs MMKV, and a different account on the same phone starts fresh).
 * Default is OFF as docs/03 §5 states (the clinical text is shown "unless the user enabled" it).
 *
 * Until `hydrated` is true the setting is unknown: the planner must not run (it could print a
 * medicine name for someone who asked for private reminders).
 *
 * The backend column `patient_profiles.private_reminders` is not served by any endpoint yet (M2-10),
 * so the switch is per account for now and applies to every family member.
 */
const storageKey = (accountId: string) => `reminderSettings:${accountId}`;

interface ReminderSettingsState {
  accountId: string | null;
  hydrated: boolean;
  privateReminders: boolean;
  hydrate: (accountId: string) => Promise<void>;
  setPrivateReminders: (value: boolean) => void;
  /** Sign-out: memory only; the encrypted cache is wiped by the caller. */
  reset: () => void;
}

export const useReminderSettings = create<ReminderSettingsState>((set, get) => ({
  accountId: null,
  hydrated: false,
  privateReminders: false,
  async hydrate(accountId) {
    if (get().accountId === accountId) return;
    set({ accountId, hydrated: false, privateReminders: false });
    let priv = false;
    try {
      const cache = await openSecureCache('patient');
      const raw = cache.getString(storageKey(accountId));
      priv = raw ? (JSON.parse(raw) as { private?: boolean }).private === true : false;
    } catch {
      // unreadable → default
    }
    if (get().accountId === accountId) set({ privateReminders: priv, hydrated: true });
  },
  setPrivateReminders(value) {
    const { accountId, hydrated } = get();
    if (!accountId || !hydrated) return;
    set({ privateReminders: value });
    void openSecureCache('patient')
      .then((cache) => cache.set(storageKey(accountId), JSON.stringify({ private: value })))
      .catch(() => undefined);
  },
  reset() {
    set({ accountId: null, hydrated: false, privateReminders: false });
  },
}));
