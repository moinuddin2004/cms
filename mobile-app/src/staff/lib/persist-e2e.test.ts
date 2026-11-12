import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';

import { openSecureCache } from '@/core/storage/secure-cache';
import { QUERY_CACHE_KEY } from '@/core/storage/query-persister';

import { createStaffPersister } from './persist-cache';
import { MAX_PERSISTED_PATIENT_DETAILS, staffDehydrateOptions } from './persist';
import { todayYmd } from './datetime';

const ORG = 'org-1';
const LOC = 'loc-1';

/** Real persistQueryClientSave + staffDehydrateOptions + the persister over the mock MMKV. */
describe('staff persistence end to end', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('writes only allow-listed, successful, today queries to the encrypted cache', async () => {
    const today = todayYmd();
    const client = new QueryClient();
    const seed = (key: unknown[]) => client.setQueryData(key, { v: 1 });

    // allowed
    seed(['access', 'me', ORG, LOC]);
    seed(['queue', 'board', LOC, today]);
    seed(['queue', 'my-session', LOC, today]);
    seed(['appointments', 'list', ORG, LOC, today]);
    seed(['patients', 'detail', ORG, LOC, 'p-1']);
    // forbidden
    seed(['patients', 'list', ORG, LOC, { search: 'zzsearchtext' }]);
    seed(['patients', 'check-phone', ORG, LOC, '0300-1234567']);
    seed(['theme', 'clinic', ORG, LOC]);
    seed(['patients', 'history', ORG, LOC, 'p-1']);
    seed(['queue', 'board', LOC, '2000-01-01']); // another day's board
    seed(['appointments', 'list', ORG, LOC, '2000-01-01']);
    // an errored detail
    await client
      .fetchQuery({
        queryKey: ['patients', 'detail', ORG, LOC, 'p-err'],
        queryFn: () => Promise.reject(new Error('500')),
        retry: false,
      })
      .catch(() => undefined);

    const cache = await openSecureCache('staff');
    await persistQueryClientSave({
      queryClient: client,
      persister: createStaffPersister(cache),
      buster: 'b',
      dehydrateOptions: staffDehydrateOptions,
    });
    await jest.advanceTimersByTimeAsync(1500); // the persister's throttle

    const raw = cache.getString(QUERY_CACHE_KEY);
    expect(raw).toBeDefined();
    const stored = JSON.parse(raw as string);
    const keys = stored.clientState.queries.map((q: { queryKey: unknown[] }) =>
      JSON.stringify(q.queryKey),
    );
    expect([...keys].sort()).toEqual(
      [
        ['access', 'me', ORG, LOC],
        ['queue', 'board', LOC, today],
        ['queue', 'my-session', LOC, today],
        ['appointments', 'list', ORG, LOC, today],
        ['patients', 'detail', ORG, LOC, 'p-1'],
      ]
        .map((k) => JSON.stringify(k))
        .sort(),
    );
    expect(raw).not.toContain('0300-1234567');
    expect(raw).not.toContain('zzsearchtext');
    expect(stored.clientState.mutations).toEqual([]);
  });

  it('keeps only the newest patient details on disk', async () => {
    const client = new QueryClient();
    const total = MAX_PERSISTED_PATIENT_DETAILS + 5;
    for (let i = 0; i < total; i++) {
      client.setQueryData(['patients', 'detail', ORG, LOC, `p-${i}`], { i }, { updatedAt: 1000 + i });
    }
    const cache = await openSecureCache('staff');
    await persistQueryClientSave({
      queryClient: client,
      persister: createStaffPersister(cache),
      buster: 'b',
      dehydrateOptions: staffDehydrateOptions,
    });
    await jest.advanceTimersByTimeAsync(1500);

    const stored = JSON.parse(cache.getString(QUERY_CACHE_KEY) as string);
    const ids = stored.clientState.queries.map((q: { queryKey: string[] }) => q.queryKey[4]);
    expect(ids).toHaveLength(MAX_PERSISTED_PATIENT_DETAILS);
    expect(ids).toContain(`p-${total - 1}`);
    expect(ids).not.toContain('p-0');
  });
});
