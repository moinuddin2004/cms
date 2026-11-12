import { QueryClient } from '@tanstack/react-query';

import {
  COALESCE_MS,
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

  it('maps a queue event to the session, next-preview and ticket keys (nothing cached)', () => {
    const { client } = setup();
    expect(queueEventKeys(client, { sessionId: SID, entryId: 'e1', seq: 1 })).toEqual([
      ['queue', 'session', SID],
      ['queue', 'next-preview', SID],
      ['queue', 'ticket', 'e1'],
    ]);
    expect(queueEventKeys(client, { sessionId: SID, entryId: null, seq: 1 })).toHaveLength(2);
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

  it('skips a session snapshot already at or above the event seq', () => {
    const { client, spy, inv } = setup();
    client.setQueryData(['queue', 'session', SID], { session: { id: SID, eventSeq: 7 } });

    inv.queueEvent({ sessionId: SID, seq: 7 });
    inv.queueEvent({ sessionId: SID, seq: 3 });
    jest.advanceTimersByTime(COALESCE_MS);
    expect(invalidatedKeys(spy)).not.toContainEqual(['queue', 'session', SID]);

    spy.mockClear();
    inv.queueEvent({ sessionId: SID, seq: 8 });
    jest.advanceTimersByTime(COALESCE_MS);
    expect(invalidatedKeys(spy)).toContainEqual(['queue', 'session', SID]);
  });

  it('compares seq per key: board ahead, session behind refreshes only the session', () => {
    const { client, spy, inv } = setup();
    const boardKey = ['queue', 'board', 'l1', '2026-11-13'];
    client.setQueryData(['queue', 'session', SID], { session: { id: SID, eventSeq: 4 } });
    client.setQueryData(boardKey, {
      lanes: [{ doctor: {}, snapshot: { session: { id: SID, eventSeq: 9 } } }],
    });

    inv.queueEvent({ sessionId: SID, seq: 9 });
    jest.advanceTimersByTime(COALESCE_MS);
    const keys = invalidatedKeys(spy);
    expect(keys).toContainEqual(['queue', 'session', SID]);
    expect(keys).not.toContainEqual(boardKey);
  });

  it('refreshes a board that is behind or lacks the session', () => {
    const { client, spy, inv } = setup();
    const behindKey = ['queue', 'board', 'l1', 'a'];
    const missingKey = ['queue', 'board', 'l1', 'b'];
    client.setQueryData(behindKey, {
      lanes: [{ doctor: {}, snapshot: { session: { id: SID, eventSeq: 2 } } }],
    });
    client.setQueryData(missingKey, { lanes: [] });
    inv.queueEvent({ sessionId: SID, seq: 5 });
    jest.advanceTimersByTime(COALESCE_MS);
    expect(invalidatedKeys(spy)).toEqual(expect.arrayContaining([behindKey, missingKey]));
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
    expect(keys).toHaveLength(4); // session, next-preview, ticket + access, each once
    expect(new Set(keys.map((k) => JSON.stringify(k))).size).toBe(4);

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
