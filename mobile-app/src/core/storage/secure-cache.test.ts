import * as SecureStore from 'expo-secure-store';

import { openSecureCache, wipeSecureCache } from './secure-cache';

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
