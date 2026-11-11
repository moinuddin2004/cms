import { createMMKV } from 'react-native-mmkv';

/**
 * Plain, unencrypted preferences. Only harmless UI values may live here
 * (docs/03 §2.6): active space, last tab/filter, theme cache, dismissed tips,
 * language. Never names, phone numbers, patient ids or API payloads.
 *
 * Adding a preference requires adding its key to `PrefKey`, which keeps the
 * unencrypted surface reviewable.
 */
export type PrefKey =
  | 'space.active'
  | 'staff.queue.segment'
  | 'staff.theme.cache'
  | 'staff.lastTab'
  | 'staff.lastFilter'
  | 'staff.tips.dismissed'
  | 'patient.language'
  | 'patient.lastTab'
  | 'patient.tips.dismissed';

const prefs = createMMKV({ id: 'prefs' });

/** Read a preference; `undefined` when it was never set. */
export function getPref<K extends PrefKey>(key: K): string | undefined {
  return prefs.getString(key);
}

/** Write a preference. Only `PrefKey` values are accepted. */
export function setPref<K extends PrefKey>(key: K, value: string): void {
  prefs.set(key, value);
}

/** Delete a preference. */
export function removePref<K extends PrefKey>(key: K): void {
  prefs.remove(key);
}
