import { create } from 'zustand';

import { getPref, setPref } from '@/core/storage/prefs';

/**
 * "Private reminders" (docs/03 §5): the lock screen shows "Medicine reminder for Ali" instead of the
 * medicine. A yes/no is a harmless preference (prefs MMKV, docs/03 §2.6). The backend column
 * `patient_profiles.private_reminders` is not served by any endpoint yet (M2-10 profiles), so for now
 * the switch is per phone and applies to every family member; `isPrivate(profileId)` is the seam a
 * per-profile value will plug into.
 */
interface ReminderSettingsState {
  privateReminders: boolean;
  setPrivateReminders: (value: boolean) => void;
}

export const useReminderSettings = create<ReminderSettingsState>((set) => ({
  privateReminders: getPref('patient.reminders.private') === '1',
  setPrivateReminders: (value) => {
    setPref('patient.reminders.private', value ? '1' : '0');
    set({ privateReminders: value });
  },
}));
