import * as Font from 'expo-font';
import { useSyncExternalStore } from 'react';

import { useT, type Locale } from './i18n';

/**
 * Noto Nastaliq Urdu for the patient space when the language is Urdu (DECISIONS O-06).
 *
 * The font package is NOT a dependency yet (adding packages is reserved for the user):
 *   npx expo install @expo-google-fonts/noto-nastaliq-urdu expo-font
 * Until it is installed the optional `require` below fails quietly and every screen keeps the system
 * font, so the app builds and runs either way. Once installed nothing else needs to change.
 */

export const URDU_FONT_REGULAR = 'NotoNastaliqUrdu_400Regular';
export const URDU_FONT_BOLD = 'NotoNastaliqUrdu_700Bold';

/** Nastaliq's tall, stacked glyphs need ~1.7-2x line height: the Text wrapper adds Tailwind `leading-loose` (2x) for Urdu. */
export const URDU_LEADING_CLASS = 'leading-loose';

type FontModule = Record<string, Font.FontSource | undefined>;

function loadFontModule(): FontModule | null {
  try {
    // Optional dependency: Metro treats a `require` inside try/catch as optional.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@expo-google-fonts/noto-nastaliq-urdu') as FontModule;
  } catch {
    return null;
  }
}

type FontState = 'idle' | 'loading' | 'ready' | 'unavailable';
let state: FontState = 'idle';
const listeners = new Set<() => void>();

function setState(next: FontState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Start loading once (idempotent). Resolves to whether the font is usable. */
export async function loadUrduFont(): Promise<boolean> {
  if (state === 'ready') return true;
  if (state === 'unavailable' || state === 'loading') return false;
  setState('loading');
  const mod = loadFontModule();
  const regular = mod?.NotoNastaliqUrdu_400Regular;
  const bold = mod?.NotoNastaliqUrdu_700Bold;
  if (!regular) {
    setState('unavailable');
    return false;
  }
  try {
    await Font.loadAsync({
      [URDU_FONT_REGULAR]: regular,
      ...(bold ? { [URDU_FONT_BOLD]: bold } : {}),
    });
    setState('ready');
    return true;
  } catch {
    setState('unavailable');
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type UrduFont = {
  /** True only for locale `ur` AND the font is loaded — the Text wrapper switches on this. */
  active: boolean;
  locale: Locale;
  regular: string;
  bold: string;
};

/**
 * Font state for the current language. Triggers loading the first time Urdu is the active locale;
 * falls back to the system font (`active: false`) when the package is missing or loading failed.
 */
export function useUrduFont(): UrduFont {
  const { locale } = useT();
  const fontState = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  if (locale === 'ur' && fontState === 'idle') void loadUrduFont();
  return {
    active: locale === 'ur' && fontState === 'ready',
    locale,
    regular: URDU_FONT_REGULAR,
    bold: URDU_FONT_BOLD,
  };
}

/** Test helper. */
export function __resetUrduFontForTests(): void {
  state = 'idle';
  listeners.clear();
}
