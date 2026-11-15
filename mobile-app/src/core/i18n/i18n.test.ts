import { getLocales } from 'expo-localization';

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
