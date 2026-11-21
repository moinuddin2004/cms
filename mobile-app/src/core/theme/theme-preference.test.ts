import { getPref, setPref } from '@/core/storage/prefs';

import {
  clearThemePreference,
  effectiveThemeMode,
  readThemePreference,
  useThemePreference,
} from './theme-preference';

const mockSetTheme = jest.fn();

jest.mock('uniwind', () => ({
  Uniwind: { setTheme: (...args: unknown[]) => mockSetTheme(...args) },
}));

describe('theme preference', () => {
  beforeEach(() => {
    clearThemePreference();
    useThemePreference.getState().setClinicDefault(null);
    mockSetTheme.mockClear();
  });

  it('resolves own choice → clinic default → phone', () => {
    expect(effectiveThemeMode(null, null)).toBe('system');
    expect(effectiveThemeMode(null, 'dark')).toBe('dark');
    expect(effectiveThemeMode('light', 'dark')).toBe('light');
  });

  it('saves the choice in prefs and applies it', () => {
    useThemePreference.getState().setPreference('light');

    expect(getPref('app.theme')).toBe('light');
    expect(useThemePreference.getState().mode()).toBe('light');
    expect(mockSetTheme).toHaveBeenLastCalledWith('light');
  });

  it('lets a clinic default apply only while the person has no choice', () => {
    useThemePreference.getState().setClinicDefault('dark');
    expect(mockSetTheme).toHaveBeenLastCalledWith('dark');

    useThemePreference.getState().setPreference('light');
    useThemePreference.getState().setClinicDefault('dark');
    expect(mockSetTheme).toHaveBeenLastCalledWith('light');

    // Leaving the staff space drops the clinic default; the own choice stays.
    useThemePreference.getState().setClinicDefault(null);
    expect(mockSetTheme).toHaveBeenLastCalledWith('light');
  });

  it('reads junk in prefs as no choice', () => {
    setPref('app.theme', 'sepia');
    expect(readThemePreference()).toBeNull();
  });
});
