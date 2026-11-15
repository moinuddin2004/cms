import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';

import { getPref, removePref, setPref } from '@/core/storage/prefs';

import { en, type MessageKey, type Messages } from './en';
import { ur } from './ur';

export type Locale = 'en' | 'ur';
export type { MessageKey } from './en';

const CATALOGS: Record<Locale, Messages> = { en, ur };
const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ur']);

export type MessageParams = Record<string, string | number>;

function isLocale(value: string | undefined | null): value is Locale {
  return value === 'en' || value === 'ur';
}

/** The phone's first supported language, else English. */
export function detectDeviceLocale(): Locale {
  try {
    for (const l of getLocales()) {
      const code = l.languageCode?.toLowerCase();
      if (isLocale(code)) return code;
    }
  } catch {
    // no localization module (tests) → English
  }
  return 'en';
}

function readInitialLocale(): Locale {
  const override = getPref('patient.language');
  return isLocale(override) ? override : detectDeviceLocale();
}

let current: Locale = readInitialLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function isRtl(locale: Locale = current): boolean {
  return RTL_LOCALES.has(locale);
}

/**
 * Override the language (stored in prefs — a language code is harmless, docs/03 §2.6).
 * `null` clears the override and follows the phone again.
 */
export function setLocale(locale: Locale | null): void {
  if (locale) setPref('patient.language', locale);
  else removePref('patient.language');
  current = locale ?? detectDeviceLocale();
  for (const listener of listeners) listener();
}

function lookup(catalog: Messages, key: string): string | undefined {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(text: string, params?: MessageParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Translate `key` in `locale` (default: the current one); a missing key falls back to English, then to the key itself. */
export function translate(
  key: MessageKey,
  params?: MessageParams,
  locale: Locale = current,
): string {
  const text = lookup(CATALOGS[locale], key) ?? lookup(en, key) ?? key;
  return interpolate(text, params);
}

export type TFunction = (key: MessageKey, params?: MessageParams) => string;

/** i18next-shaped `t`, bound to the current locale. */
export const t: TFunction = (key, params) => translate(key, params);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `t` that re-renders the component when the locale changes. */
export function useT(): { t: TFunction; locale: Locale; isRtl: boolean } {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return {
    t: (key, params) => translate(key, params, locale),
    locale,
    isRtl: isRtl(locale),
  };
}
