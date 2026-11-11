import * as SecureStore from 'expo-secure-store';

import { openSecureCache, wipeSecureCache } from './secure-cache';

// The Jest runner is card M0-06; until it (and @types/jest) lands, read the
// globals from `globalThis` so `tsc --noEmit` stays green.
const { beforeEach, describe, it, expect } = globalThis as unknown as {
  beforeEach: (fn: () => void | Promise<void>) => void;
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => void | Promise<void>) => void;
  expect: (actual: unknown) => {
    toBe: (expected: unknown) => void;
    toBeNull: () => void;
    toBeUndefined: () => void;
  };
};

const KEY = '0123456789abcdef0123456789abcdef';

describe('secure cache', () => {
  beforeEach(async () => {
    await wipeSecureCache('staff');
  });

  it('opens with the key from SecureStore and reuses the instance', async () => {
    await SecureStore.setItemAsync('staff.cacheKey', KEY);

    const first = await openSecureCache('staff');
    first.set('probe', 'one');

    const second = await openSecureCache('staff');

    expect(second).toBe(first);
    expect(second.getString('probe')).toBe('one');
    expect(await SecureStore.getItemAsync('staff.cacheKey')).toBe(KEY);
  });

  it('wipes data and the key', async () => {
    await SecureStore.setItemAsync('staff.cacheKey', KEY);
    const cache = await openSecureCache('staff');
    cache.set('probe', 'one');

    await wipeSecureCache('staff');

    expect(await SecureStore.getItemAsync('staff.cacheKey')).toBeNull();

    await SecureStore.setItemAsync('staff.cacheKey', KEY);
    const reopened = await openSecureCache('staff');
    expect(reopened.getString('probe')).toBeUndefined();
  });
});
