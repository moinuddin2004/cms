import { createMMKV } from 'react-native-mmkv';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

import {
  createSecureQueryPersister,
  QUERY_CACHE_KEY,
} from './query-persister';

// The Jest runner is card M0-06; until it (and @types/jest) lands, read the
// globals from `globalThis` so `tsc --noEmit` stays green.
const { describe, it, expect } = globalThis as unknown as {
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => void | Promise<void>) => void;
  expect: (actual: unknown) => {
    toEqual: (expected: unknown) => void;
    toBeUndefined: () => void;
  };
};

const client: PersistedClient = {
  timestamp: 1_700_000_000_000,
  buster: 'test',
  clientState: { mutations: [], queries: [] },
};

describe('secure query persister', () => {
  it('restores and removes the cached client', async () => {
    const cache = createMMKV({ id: 'persister-test' });
    cache.clearAll();
    const persister = createSecureQueryPersister(cache);

    cache.set(QUERY_CACHE_KEY, JSON.stringify(client));
    expect(await persister.restoreClient()).toEqual(client);

    await persister.removeClient();
    expect(await persister.restoreClient()).toBeUndefined();
  });
});
