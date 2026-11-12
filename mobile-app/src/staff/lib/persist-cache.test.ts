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

  it('drops a throttled write queued BEFORE the wipe that fires after it', async () => {
    const cache = await openSecureCache('staff');
    const setSpy = jest.spyOn(cache, 'set');
    const removeSpy = jest.spyOn(cache, 'remove');
    const persister = createStaffPersister(cache);

    await persister.persistClient(client('queued')); // throttle timer started, nothing written yet
    expect(setSpy).not.toHaveBeenCalled();
    await wipeStaffPersistedCache();
    setSpy.mockClear();
    removeSpy.mockClear();
    await flushThrottle(); // the trailing write fires now

    expect(setSpy).not.toHaveBeenCalled(); // no `set` on the old instance
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('a persister created after sign-out is not sealed by it', async () => {
    const old = createStaffPersister(await openSecureCache('staff'));
    await wipeStaffPersistedCache();
    const fresh = createStaffPersister(await openSecureCache('staff'));
    await fresh.persistClient(client('new-login'));
    await flushThrottle();
    expect((await fresh.restoreClient())?.buster).toBe('new-login');
    await old.persistClient(client('stale'));
    await flushThrottle();
    expect((await fresh.restoreClient())?.buster).toBe('new-login');
  });

  it('ignores a persistClient call that arrives after sign-out', async () => {
    const cache = await openSecureCache('staff');
    const persister = createStaffPersister(cache);
    await wipeStaffPersistedCache();
    await persister.persistClient(client('late'));
    await flushThrottle();

    const reopened = await openSecureCache('staff');
    expect(reopened.getAllKeys()).toEqual([]);
  });
});
