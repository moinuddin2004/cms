import { QueryClient } from '@tanstack/react-query';

import {
  COALESCE_MS,
  cachedEventSeq,
  createRealtimeInvalidator,
  queueEventKeys,
} from './realtime-invalidation';

const SID = 's1';

function setup() {
  const client = new QueryClient();
  const spy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  return { client, spy, inv: createRealtimeInvalidator(client) };
}

const invalidatedKeys = (spy: jest.SpyInstance) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);

describe('realtime invalidation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('maps a queue event to the session, board, my-session, next-preview and ticket keys', () => {
    expect(queueEventKeys({ sessionId: SID, entryId: 'e1' })).toEqual([
      ['queue', 'session', SID],
      ['queue', 'next-preview', SID],
      ['queue', 'board'],
      ['queue', 'my-session'],
      ['queue', 'ticket', 'e1'],
    ]);
    expect(queueEventKeys({ sessionId: SID, entryId: null })).toHaveLength(4);
  });

  it('access.changed invalidates the access keys', () => {
    const { spy, inv } = setup();
    inv.accessChanged();
    jest.advanceTimersByTime(COALESCE_MS);
    expect(invalidatedKeys(spy)).toEqual([['access']]);
  });

  it('notification.new invalidates the notification keys', () => {
    const { spy, inv } = setup();
    inv.notificationNew();
    jest.advanceTimersByTime(COALESCE_MS);
    expect(invalidatedKeys(spy)).toEqual([['notifications']]);
  });

  it('all() invalidates every realtime-driven key family', () => {
    const { spy, inv } = setup();
    inv.all();
    jest.advanceTimersByTime(COALESCE_MS);
    expect(invalidatedKeys(spy)).toEqual([['queue'], ['access'], ['notifications']]);
  });

  it('ignores a queue event whose seq is not newer than the cached snapshot', () => {
    const { client, spy, inv } = setup();
    client.setQueryData(['queue', 'session', SID], { session: { id: SID, eventSeq: 7 } });

    inv.queueEvent({ sessionId: SID, seq: 7 });
    inv.queueEvent({ sessionId: SID, seq: 3 });
    jest.advanceTimersByTime(COALESCE_MS);
    expect(spy).not.toHaveBeenCalled();

    inv.queueEvent({ sessionId: SID, seq: 8 });
    jest.advanceTimersByTime(COALESCE_MS);
    expect(spy).toHaveBeenCalled();
  });

  it('reads the cached seq from board lanes too, and invalidates when nothing is cached', () => {
    const { client, spy, inv } = setup();
    expect(cachedEventSeq(client, SID)).toBeUndefined();
    inv.queueEvent({ sessionId: SID, seq: 1 });
    jest.advanceTimersByTime(COALESCE_MS);
    expect(spy).toHaveBeenCalled();

    spy.mockClear();
    client.setQueryData(['queue', 'board', 'l1', '2026-11-13'], {
      lanes: [{ doctor: {}, snapshot: { session: { id: SID, eventSeq: 9 } } }],
    });
    expect(cachedEventSeq(client, SID)).toBe(9);
    inv.queueEvent({ sessionId: SID, seq: 9 });
    jest.advanceTimersByTime(COALESCE_MS);
    expect(spy).not.toHaveBeenCalled();
  });

  it('coalesces a burst into one invalidation per key per 300 ms window', () => {
    const { spy, inv } = setup();
    inv.queueEvent({ sessionId: SID, seq: 1, entryId: 'e1' });
    inv.queueEvent({ sessionId: SID, seq: 2, entryId: 'e1' });
    inv.accessChanged();
    inv.accessChanged();
    jest.advanceTimersByTime(COALESCE_MS - 1);
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    const keys = invalidatedKeys(spy);
    expect(keys).toHaveLength(6); // 5 queue keys + access, each once
    expect(new Set(keys.map((k) => JSON.stringify(k))).size).toBe(6);

    spy.mockClear();
    inv.accessChanged(); // a new window
    jest.advanceTimersByTime(COALESCE_MS);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('dispose drops pending work', () => {
    const { spy, inv } = setup();
    inv.accessChanged();
    inv.dispose();
    jest.advanceTimersByTime(COALESCE_MS * 2);
    expect(spy).not.toHaveBeenCalled();
  });
});
