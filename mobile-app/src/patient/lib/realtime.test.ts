import { AppState } from 'react-native';
import type { Socket } from 'socket.io-client';

import {
  BACKGROUND_DISCONNECT_MS,
  PatientRealtime,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  reconnectDelay,
  SUBSCRIBE_RETRY_MS,
} from './realtime';
import type { PatientInvalidator } from './realtime-invalidation';

type Handler = (...args: unknown[]) => void;

class FakeSocket {
  connected = false;
  active = false;
  handlers = new Map<string, Handler>();
  emits: { event: string; payload: unknown }[] = [];
  ackResult: { ok: boolean } = { ok: true };
  connect = jest.fn(() => {
    this.active = true;
  });
  disconnect = jest.fn(() => {
    this.connected = false;
    this.active = false;
  });
  removeAllListeners = jest.fn();
  on(event: string, h: Handler) {
    this.handlers.set(event, h);
    return this;
  }
  emit(event: string, payload: unknown, ack?: Handler) {
    this.emits.push({ event, payload });
    ack?.(this.ackResult);
  }
  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.(...args);
  }
  serverConnect() {
    this.connected = true;
    this.fire('connect');
  }
}

function setup(withRefresh = false) {
  const socket = new FakeSocket();
  const invalidator: jest.Mocked<PatientInvalidator> = {
    visitEvent: jest.fn(),
    feedChanged: jest.fn(),
    all: jest.fn(),
    dispose: jest.fn(),
  };
  const refreshSession = jest.fn(async () => ({ ok: true }));
  const realtime = new PatientRealtime({
    getToken: () => 'tok',
    invalidator,
    ...(withRefresh ? { refreshSession } : {}),
    createSocket: () => socket as unknown as Socket,
  });
  return { socket, invalidator, realtime, refreshSession };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('PatientRealtime', () => {
  it('joins an entry room on connect and is live only after the subscribe ack', () => {
    const { socket, realtime } = setup();
    realtime.connect();
    realtime.watchEntry('e1');
    expect(realtime.isLive()).toBe(false);
    socket.serverConnect();
    expect(socket.emits).toEqual([{ event: 'subscribe', payload: { room: 'entry:e1' } }]);
    expect(realtime.isLive()).toBe(true);
  });

  it('visit.event and feed.changed only invalidate', () => {
    const { socket, invalidator, realtime } = setup();
    realtime.connect();
    socket.serverConnect();
    socket.fire('visit.event', { entryId: 'e1', seq: 4 });
    socket.fire('feed.changed', { kinds: ['links'] });
    expect(invalidator.visitEvent).toHaveBeenCalledWith({ entryId: 'e1', seq: 4 });
    expect(invalidator.feedChanged).toHaveBeenCalledWith({ kinds: ['links'] });
  });

  it('a refused subscribe is retried with backoff and keeps the screen polling (not live)', () => {
    const { socket, realtime } = setup();
    socket.ackResult = { ok: false };
    realtime.connect();
    realtime.watchEntry('e1');
    socket.serverConnect();
    expect(realtime.isLive()).toBe(false);
    expect(socket.emits).toHaveLength(1);
    jest.advanceTimersByTime(SUBSCRIBE_RETRY_MS[0]);
    expect(socket.emits).toHaveLength(2);
    socket.ackResult = { ok: true };
    jest.advanceTimersByTime(SUBSCRIBE_RETRY_MS[1]);
    expect(realtime.isLive()).toBe(true);
  });

  it('auth_error: not live, schedules a reconnect with backoff, never signs out', () => {
    const { socket, invalidator, realtime } = setup();
    // no refreshSession dep here: plain backoff
    realtime.connect();
    realtime.watchEntry('e1');
    socket.serverConnect();
    expect(realtime.isLive()).toBe(true);

    socket.fire('auth_error', { message: 'x' });
    expect(realtime.isLive()).toBe(false);
    expect(invalidator.all).toHaveBeenCalled();
    socket.connect.mockClear();
    jest.advanceTimersByTime(RECONNECT_BASE_MS - 1);
    expect(socket.connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('a server-side disconnect is retried; the delay doubles up to the cap', () => {
    expect(reconnectDelay(0)).toBe(RECONNECT_BASE_MS);
    expect(reconnectDelay(1)).toBe(RECONNECT_BASE_MS * 2);
    expect(reconnectDelay(20)).toBe(RECONNECT_MAX_MS);

    const { socket, realtime } = setup();
    realtime.connect();
    socket.serverConnect();
    socket.connect.mockClear();
    socket.fire('disconnect', 'io server disconnect');
    jest.advanceTimersByTime(RECONNECT_BASE_MS);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    socket.fire('disconnect', 'io server disconnect');
    jest.advanceTimersByTime(RECONNECT_BASE_MS * 2);
    expect(socket.connect).toHaveBeenCalledTimes(2);
  });

  it('an unavailable signal means not live and a retry', () => {
    const { socket, realtime } = setup();
    realtime.connect();
    realtime.watchEntry('e1');
    socket.serverConnect();
    socket.fire('unavailable');
    expect(realtime.isLive()).toBe(false);
    socket.connect.mockClear();
    jest.advanceTimersByTime(RECONNECT_BASE_MS);
    expect(socket.connect).toHaveBeenCalled();
  });

  it('unavailable honours retryAfterSeconds and does not refresh the session', () => {
    const { socket, realtime, refreshSession } = setup();
    realtime.connect();
    socket.serverConnect();
    socket.connect.mockClear();
    socket.fire('unavailable', { retryAfterSeconds: 7 });
    expect(realtime.isLive()).toBe(false);
    jest.advanceTimersByTime(6_999);
    expect(socket.connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('auth_error with a refresh: refreshes once, then reconnects', async () => {
    const { socket, realtime, refreshSession } = setup(true);
    realtime.connect();
    socket.serverConnect();
    socket.connect.mockClear();
    socket.fire('auth_error', { message: 'x' });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(0);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('a failing refresh (offline) still reconnects and never throws', async () => {
    const { socket, realtime, refreshSession } = setup(true);
    refreshSession.mockRejectedValue(new Error('offline'));
    realtime.connect();
    socket.serverConnect();
    socket.connect.mockClear();
    socket.fire('auth_error');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(0);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('a reconnect refetches once (events may have been missed)', () => {
    const { socket, invalidator, realtime } = setup();
    realtime.connect();
    socket.serverConnect();
    expect(invalidator.all).not.toHaveBeenCalled();
    socket.serverConnect();
    expect(invalidator.all).toHaveBeenCalledTimes(1);
  });

  it('leaving the last watcher unsubscribes and drops live', () => {
    const { socket, realtime } = setup();
    realtime.connect();
    const leave = realtime.watchEntry('e1');
    socket.serverConnect();
    leave();
    expect(socket.emits.at(-1)).toEqual({ event: 'unsubscribe', payload: { room: 'entry:e1' } });
    expect(realtime.isLive()).toBe(false);
  });

  it('closes 30 s after the app goes to the background and reopens on foreground', () => {
    let listener: (s: string) => void = () => undefined;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(((_: string, cb: (s: string) => void) => {
        listener = cb;
        return { remove: jest.fn() };
      }) as never);
    const { socket, realtime } = setup();
    realtime.connect();
    realtime.attachAppLifecycle();
    socket.serverConnect();
    listener('background');
    jest.advanceTimersByTime(BACKGROUND_DISCONNECT_MS);
    expect(socket.disconnect).toHaveBeenCalled();
    socket.connect.mockClear();
    listener('active');
    expect(socket.connect).toHaveBeenCalled();
  });
});
