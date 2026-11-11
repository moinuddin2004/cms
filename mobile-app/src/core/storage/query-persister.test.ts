import { createMMKV } from 'react-native-mmkv';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

import {
  createSecureQueryPersister,
  QUERY_CACHE_KEY,
} from './query-persister';

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
