import { readFileSync } from 'fs';
import { getLocales } from 'expo-localization';
import { join } from 'path';

import { getPref } from '@/core/storage/prefs';

import { en } from './en';
import { detectDeviceLocale, getLocale, isRtl, setLocale, t, translate } from './i18n';
import { ur } from './ur';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'en' }]) }));

function keysOf(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keysOf(v as object, `${prefix}${k}.`),
  );
}

describe('i18n', () => {
  afterEach(() => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
    setLocale(null);
  });

  it('looks up nested keys', () => {
    expect(translate('auth.signIn.title', undefined, 'en')).toBe('Sign in');
    expect(translate('auth.signIn.title', undefined, 'ur')).toBe(ur.auth.signIn.title);
  });

  it('interpolates {params} and leaves unknown ones visible', () => {
    expect(translate('home.signedInAs', { email: 'a@b.co' }, 'en')).toBe('Signed in as a@b.co');
    expect(translate('auth.verify.resendIn', {}, 'en')).toBe('Send a new code in {seconds}s');
    expect(translate('auth.verify.resendIn', { seconds: 42 }, 'en')).toBe('Send a new code in 42s');
  });

  it('falls back to English, then to the key, for a missing key', () => {
    const catalog = ur.common as unknown as Record<string, string | undefined>;
    const saved = catalog.cancel;
    delete catalog.cancel;
    try {
      expect(translate('common.cancel', undefined, 'ur')).toBe(en.common.cancel);
    } finally {
      catalog.cancel = saved;
    }
    expect(translate('nope.missing' as never, undefined, 'en')).toBe('nope.missing');
  });

  it('ur has exactly the keys of en', () => {
    expect(keysOf(ur).sort()).toEqual(keysOf(en).sort());
  });

  it('keeps the {params} of every English string in the Urdu one', () => {
    const flat = (o: object, prefix = ''): Record<string, string> =>
      Object.fromEntries(
        Object.entries(o).flatMap(([k, v]) =>
          typeof v === 'string' ? [[prefix + k, v]] : Object.entries(flat(v as object, `${prefix}${k}.`)),
        ),
      );
    const params = (v: string) => (v.match(/\{\w+\}/g) ?? []).sort();
    const enFlat = flat(en);
    const urFlat = flat(ur);
    for (const key of Object.keys(enFlat)) {
      expect({ key, params: params(urFlat[key]) }).toEqual({ key, params: params(enFlat[key]) });
    }
  });

  // How to add a string after M4-01: add the key to `en.ts`, then give `ur.ts` a real Urdu text in the
  // SAME change. Only if it genuinely cannot be translated yet, copy the English and mark the line
  // `// TODO(ur)` AND list its dotted key here so the gap is visible. Remove it from here when done.
  const UR_TODO_ALLOW_LIST: readonly string[] = [];

  it('every Urdu string has Urdu script unless its key is allow-listed', () => {
    const LATIN_OK = new Set([
      'auth.signIn.emailPlaceholder',
      'auth.verify.codePlaceholder',
      'account.delete.typePlaceholder',
    ]);
    const flat = (o: object, prefix = ''): [string, string][] =>
      Object.entries(o).flatMap(([k, v]): [string, string][] =>
        typeof v === 'string' ? [[prefix + k, v]] : flat(v as object, `${prefix}${k}.`),
      );
    const bad = flat(ur)
      .filter(([k, v]) => !LATIN_OK.has(k) && !/[؀-ۿ]/.test(v))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('has no untranslated TODO(ur) markers outside the allow-list', () => {
    const source = readFileSync(join(__dirname, 'ur.ts'), 'utf8');
    const markers = source.split('\n').filter((l) => l.includes('// TODO(ur)') && !l.trimStart().startsWith('*'));
    expect(markers.length).toBeLessThanOrEqual(UR_TODO_ALLOW_LIST.length);
  });

  it('follows the phone language, an override wins and persists, null clears it', () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'fr' }, { languageCode: 'ur' }]);
    expect(detectDeviceLocale()).toBe('ur');
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(getPref('patient.language')).toBe('en');
    expect(t('auth.signIn.title')).toBe('Sign in');
    setLocale(null);
    expect(getLocale()).toBe('ur');
    expect(getPref('patient.language')).toBeUndefined();
  });

  it('exposes the RTL flag for ur only', () => {
    setLocale('ur');
    expect(isRtl()).toBe(true);
    setLocale('en');
    expect(isRtl()).toBe(false);
  });
});
