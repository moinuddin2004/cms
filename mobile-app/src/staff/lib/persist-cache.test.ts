import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

import { openSecureCache } from '@/core/storage/secure-cache';

import { createStaffPersister, wipeStaffPersistedCache } from './persist-cache';

const client = (buster: string): PersistedClient => ({
  timestamp: Date.now(),
  buster,
  clientState: dehydrate(new QueryClient()),
});

// TanStack's storage persister throttles writes (1 s, trailing).
const flushThrottle = () => jest.advanceTimersByTimeAsync(1500);

describe('staff persisted cache', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sign-out wipe removes the persisted client and the encrypted cache', async () => {
    const cache = await openSecureCache('staff');
    const persister = createStaffPersister(cache);
    await persister.persistClient(client('b1'));
    await flushThrottle();
    expect((await persister.restoreClient())?.buster).toBe('b1');

    await wipeStaffPersistedCache();

    // a fresh open starts empty (new key, new file)
    const reopened = await openSecureCache('staff');
    expect(await createStaffPersister(reopened).restoreClient()).toBeUndefined();
  });

  it('ignores a late throttled write after sign-out', async () => {
    const cache = await openSecureCache('staff');
    const persister = createStaffPersister(cache);
    await wipeStaffPersistedCache();
    await persister.persistClient(client('late'));
    await flushThrottle();

    const reopened = await openSecureCache('staff');
    expect(reopened.getAllKeys()).toEqual([]);
  });
});
