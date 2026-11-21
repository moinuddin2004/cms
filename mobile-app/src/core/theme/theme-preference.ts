import { create } from 'zustand';

import { getPref, removePref, setPref } from '@/core/storage/prefs';

import { applyThemeMode, type ThemeMode } from './apply-theme-mode';

/**
 * The person's own light / dark / system choice — the web app's `useTheme`
 * rule on the phone: the user's saved choice wins, else the clinic's
 * `theme.default_mode` (staff space only), else the phone setting.
 *
 * Kept in plain prefs (`app.theme`): a UI value, never anything about a person
 * (docs/03 §2.6). It is app-wide, so the welcome page, both spaces and a space
 * switch all keep the same look; signing out does not reset it.
 */
const PREF_KEY = 'app.theme';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** The saved choice, or `null` when the person never picked one (prefs are unvalidated). */
export function readThemePreference(): ThemeMode | null {
  const raw = getPref(PREF_KEY);
  return isThemeMode(raw) ? raw : null;
}

/** Which mode actually applies: own choice → clinic default → phone. */
export function effectiveThemeMode(
  preference: ThemeMode | null,
  clinicDefault: ThemeMode | null,
): ThemeMode {
  return preference ?? clinicDefault ?? 'system';
}

interface ThemePreferenceState {
  /** The person's own choice; `null` = follow the clinic default / phone. */
  preference: ThemeMode | null;
  /** `theme.default_mode` of the active clinic while the staff space is open. */
  clinicDefault: ThemeMode | null;
  /** What the picker shows as selected. */
  mode: () => ThemeMode;
  setPreference: (mode: ThemeMode) => void;
  setClinicDefault: (mode: ThemeMode | null | undefined) => void;
}

export const useThemePreference = create<ThemePreferenceState>((set, get) => ({
  preference: readThemePreference(),
  clinicDefault: null,
  mode: () => effectiveThemeMode(get().preference, get().clinicDefault),
  setPreference: (mode) => {
    if (!isThemeMode(mode)) return;
    setPref(PREF_KEY, mode);
    set({ preference: mode });
    applyThemeMode(effectiveThemeMode(mode, get().clinicDefault));
  },
  setClinicDefault: (mode) => {
    const clinicDefault = isThemeMode(mode) ? mode : null;
    set({ clinicDefault });
    applyThemeMode(effectiveThemeMode(get().preference, clinicDefault));
  },
}));

/** Paint the saved choice at start-up, before the first screen renders. */
export function applyStoredThemePreference(): void {
  const { preference, clinicDefault } = useThemePreference.getState();
  applyThemeMode(effectiveThemeMode(preference, clinicDefault));
}

/** Forget the choice (tests; a future "reset settings"). */
export function clearThemePreference(): void {
  removePref(PREF_KEY);
  useThemePreference.setState({ preference: null });
  applyStoredThemePreference();
}
