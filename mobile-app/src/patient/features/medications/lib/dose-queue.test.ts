import { postDoseEvents } from '../api/medications.api';
import { QueryClient } from '@tanstack/react-query';

import { medicationKeys } from '../api/medications.keys';
import { mergeDoseEvents } from './dose-events-cache';
import { chunk, flushDoseQueue, removeSent, upsertQueued, useDoseQueueStore } from './dose-queue';
import { at, event } from './test-fixtures';

jest.mock('../api/medications.api', () => ({ postDoseEvents: jest.fn() }));
const post = postDoseEvents as jest.MockedFunction<typeof postDoseEvents>;

const httpError = (status: number) => Object.assign(new Error('http'), { isAxiosError: true, response: { status } });
const D1 = at(2026, 11, 16, 8);
const D2 = at(2026, 11, 16, 20);

describe('queue helpers', () => {
  it('upsert keeps one event per dose, the newest wins', () => {
    const a = event('s', D1, 'taken', 1000);
    const b = event('s', D1, 'skipped', 2000);
    expect(upsertQueued([a], b)).toEqual([b]);
    expect(upsertQueued([b], a)).toEqual([b]);
  });

  it('removeSent keeps an event changed while the request was in flight', () => {
    const sent = event('s', D1, 'taken', 1000);
    const changed = event('s', D1, 'skipped', 2000);
    expect(removeSent([changed], [sent])).toEqual([changed]);
    expect(removeSent([sent], [sent])).toEqual([]);
  });

  it('chunk splits into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('flushDoseQueue', () => {
  let client: QueryClient;
  beforeEach(async () => {
    client = new QueryClient();
    post.mockReset();
    useDoseQueueStore.getState().reset();
    await useDoseQueueStore.getState().hydrate('acc-1');
  });

  it('is saved locally first, then sent and cleared', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    expect(useDoseQueueStore.getState().items).toHaveLength(1);
    post.mockResolvedValue(1);
    expect(await flushDoseQueue(client)).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(useDoseQueueStore.getState().items).toEqual([]);
  });

  it('keeps everything while offline (no response) and sends after reconnect', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    useDoseQueueStore.getState().enqueue(event('s', D2, 'skipped'));
    post.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    expect(await flushDoseQueue(client)).toBe(false);
    expect(useDoseQueueStore.getState().items).toHaveLength(2);
    post.mockResolvedValue(2);
    expect(await flushDoseQueue(client)).toBe(true);
    expect(post).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ action: 'skipped' })]));
    expect(useDoseQueueStore.getState().items).toEqual([]);
  });

  it('keeps events on a server error', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    post.mockRejectedValue(httpError(503));
    await flushDoseQueue(client);
    expect(useDoseQueueStore.getState().items).toHaveLength(1);
  });

  it('a rejected batch is retried one by one and only the bad event is dropped', async () => {
    useDoseQueueStore.getState().enqueue(event('good', D1));
    useDoseQueueStore.getState().enqueue(event('bad', D2));
    post.mockImplementation(async (events) => {
      if (events.length > 1 || events[0].scheduleId === 'bad') throw httpError(404);
      return 1;
    });
    expect(await flushDoseQueue(client)).toBe(true);
    expect(useDoseQueueStore.getState().items).toEqual([]);
  });

  it('refuses (returns false) to enqueue before an account is known or after reset', () => {
    useDoseQueueStore.getState().reset();
    expect(useDoseQueueStore.getState().enqueue(event('s', D1))).toBe(false);
    expect(useDoseQueueStore.getState().items).toEqual([]);
  });

  it('patches the cached dose-events BEFORE the event leaves the queue (no flash back to pending)', async () => {
    const key = medicationKeys.doseEvents('acc-1', '2026-11-15');
    const other = event('o', D2);
    client.setQueryData(key, [other]);
    const taken = event('s', D1);
    useDoseQueueStore.getState().enqueue(taken);
    post.mockResolvedValue(1);
    let cachedWhenRemoved: unknown = null;
    const unsub = useDoseQueueStore.subscribe((state, prev) => {
      if (prev.items.length === 1 && state.items.length === 0) cachedWhenRemoved = client.getQueryData(key);
    });
    await flushDoseQueue(client);
    unsub();
    expect(cachedWhenRemoved).toEqual(expect.arrayContaining([other, taken]));
    expect(client.getQueryData(key)).toEqual(expect.arrayContaining([other, taken]));
  });

  it('creates the current window query when none is cached', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    post.mockResolvedValue(1);
    await flushDoseQueue(client);
    const all = client.getQueriesData<unknown[]>({ queryKey: ['dose-events', 'acc-1'] });
    expect(all).toHaveLength(1);
    expect(all[0][1]).toHaveLength(1);
  });

  it('survives an app restart: a new store reads the encrypted copy', async () => {
    useDoseQueueStore.getState().enqueue(event('s', D1));
    await new Promise((r) => setTimeout(r, 0));
    useDoseQueueStore.getState().reset();
    await useDoseQueueStore.getState().hydrate('acc-1');
    expect(useDoseQueueStore.getState().items).toHaveLength(1);
    useDoseQueueStore.getState().remove(useDoseQueueStore.getState().items);
  });
});

describe('mergeDoseEvents', () => {
  it('newer actedAt wins per dose; others are kept', () => {
    const old = event('s', D1, 'taken', 1000);
    const newer = event('s', D1, 'skipped', 2000);
    const stale = event('s', D1, 'taken', 500);
    const other = event('o', D2);
    expect(mergeDoseEvents([old, other], [newer])).toEqual(expect.arrayContaining([newer, other]));
    expect(mergeDoseEvents([newer], [stale])).toEqual([newer]);
  });
});
