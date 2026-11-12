import { AppState } from 'react-native';
import type { Socket } from 'socket.io-client';

import { BACKGROUND_DISCONNECT_MS, StaffRealtime } from './realtime';
import type { RealtimeInvalidator } from './realtime-invalidation';

type Handler = (...args: unknown[]) => void;

/** Minimal socket.io-client stand-in: records emits, lets tests fire events. */
class FakeSocket {
  connected = false;
  active = false;
  handlers = new Map<string, Handler>();
  emits: { event: string; payload: unknown }[] = [];
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
    ack?.({ ok: true });
  }
  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.(...args);
  }
  serverConnect() {
    this.connected = true;
    this.fire('connect');
  }
}

function setup(
  overrides: { refreshSession?: () => Promise<unknown>; token?: () => string | null } = {},
) {
  const socket = new FakeSocket();
  const invalidator: jest.Mocked<RealtimeInvalidator> = {
    queueEvent: jest.fn(),
    accessChanged: jest.fn(),
    notificationNew: jest.fn(),
    all: jest.fn(),
    dispose: jest.fn(),
  };
  const refreshSession = jest.fn(overrides.refreshSession ?? (async () => ({ ok: true })));
  const onNotification = jest.fn();
  const realtime = new StaffRealtime({
    getToken: overrides.token ?? (() => 'tok'),
    refreshSession,
    invalidator,
    onNotification,
    createSocket: () => socket as unknown as Socket,
  });
  return { socket, invalidator, refreshSession, onNotification, realtime };
}

const subscribes = (s: FakeSocket) =>
  s.emits.filter((e) => e.event === 'subscribe').map((e) => (e.payload as { room: string }).room);

describe('StaffRealtime', () => {
  let appStateHandler: (s: string) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(((_e: string, h: (s: string) => void) => {
        appStateHandler = h;
        return { remove: jest.fn() };
      }) as never);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('routes socket events to the invalidator', () => {
    const { socket, invalidator, onNotification, realtime } = setup();
    realtime.connect();
    socket.serverConnect();

    socket.fire('queue.event', { sessionId: 's', seq: 1 });
    socket.fire('access.changed', { organizationId: 'o', version: 2 });
    socket.fire('notification.new', { id: 'n1', title: 'Hi' });

    expect(invalidator.queueEvent).toHaveBeenCalledWith({ sessionId: 's', seq: 1 });
    expect(invalidator.accessChanged).toHaveBeenCalledTimes(1);
    expect(invalidator.notificationNew).toHaveBeenCalledTimes(1);
    expect(onNotification).toHaveBeenCalledWith({ id: 'n1', title: 'Hi' });
  });

  it('joins rooms once connected and re-joins them after a reconnect, invalidating all', () => {
    const { socket, invalidator, realtime } = setup();
    realtime.connect();
    realtime.joinRoom('org:o1'); // before connect: deferred
    expect(subscribes(socket)).toEqual([]);

    socket.serverConnect();
    expect(subscribes(socket)).toEqual(['org:o1']);
    expect(invalidator.all).not.toHaveBeenCalled(); // first connect

    socket.connected = false;
    socket.fire('disconnect');
    socket.serverConnect();
    expect(subscribes(socket)).toEqual(['org:o1', 'org:o1']);
    expect(invalidator.all).toHaveBeenCalledTimes(1);
  });

  it('counts shared rooms and unsubscribes on the last leave', () => {
    const { socket, realtime } = setup();
    realtime.connect();
    socket.serverConnect();
    const a = realtime.joinRoom('location:l1:board');
    const b = realtime.joinRoom('location:l1:board');
    expect(subscribes(socket)).toEqual(['location:l1:board']);
    a();
    expect(socket.emits.some((e) => e.event === 'unsubscribe')).toBe(false);
    b();
    b(); // idempotent
    expect(socket.emits.filter((e) => e.event === 'unsubscribe')).toHaveLength(1);
  });

  it('auth_error refreshes the session once, reconnects, and does not loop', async () => {
    const { socket, refreshSession, realtime } = setup();
    realtime.connect();
    socket.serverConnect();

    socket.fire('auth_error', { message: 'Invalid or expired token' });
    socket.fire('auth_error', { message: 'Invalid or expired token' });
    await Promise.resolve();
    await Promise.resolve();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(2); // initial + reconnect
    expect(realtime.isConnected()).toBe(false);
  });

  it('auth_error with a signed-out session does not reconnect', async () => {
    const { socket, realtime } = setup({ refreshSession: async () => null });
    realtime.connect();
    socket.serverConnect();
    socket.fire('auth_error', {});
    await Promise.resolve();
    await Promise.resolve();
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('is live only after the org-room subscribe ack is ok', () => {
    const { socket, realtime } = setup();
    realtime.joinRoom('org:o1');
    realtime.connect();
    socket.emit = jest.fn((event: string, payload: unknown, ack?: Handler) => {
      socket.emits.push({ event, payload });
      ack?.({ ok: false });
    });
    socket.serverConnect();
    expect(realtime.isConnected()).toBe(false); // connected, ack refused

    socket.emit = jest.fn((event: string, payload: unknown, ack?: Handler) => {
      socket.emits.push({ event, payload });
      ack?.({ ok: true });
    });
    socket.connected = false;
    socket.fire('disconnect');
    socket.serverConnect(); // the next connect retries the subscribe
    expect(realtime.isConnected()).toBe(true);
  });

  it('is not live on connect alone (no org room joined yet)', () => {
    const { socket, realtime } = setup();
    realtime.connect();
    socket.serverConnect();
    expect(realtime.isConnected()).toBe(false);
  });

  it('can connect again after dispose (StrictMode second effect run)', () => {
    const sockets: FakeSocket[] = [];
    const realtime = new StaffRealtime({
      getToken: () => 't',
      refreshSession: async () => null,
      invalidator: {
        queueEvent: jest.fn(),
        accessChanged: jest.fn(),
        notificationNew: jest.fn(),
        all: jest.fn(),
        dispose: jest.fn(),
      },
      createSocket: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s as unknown as Socket;
      },
    });
    realtime.connect();
    realtime.dispose();
    realtime.connect();
    expect(sockets).toHaveLength(2);
    expect(sockets.filter((s) => s.active)).toHaveLength(1);
    expect(sockets[0].disconnect).toHaveBeenCalled();
  });

  it('disconnects 30 s after backgrounding and reconnects + invalidates on foreground', () => {
    const { socket, invalidator, realtime } = setup();
    realtime.connect();
    socket.serverConnect();
    realtime.attachAppLifecycle();

    appStateHandler('background');
    jest.advanceTimersByTime(BACKGROUND_DISCONNECT_MS - 1);
    expect(socket.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);

    appStateHandler('active');
    expect(socket.connect).toHaveBeenCalledTimes(2);
    socket.serverConnect();
    expect(invalidator.all).toHaveBeenCalledTimes(1);
  });

  it('a quick return to the foreground keeps the socket and invalidates nothing', () => {
    const { socket, invalidator, realtime } = setup();
    realtime.connect();
    socket.serverConnect();
    realtime.attachAppLifecycle();

    appStateHandler('background');
    jest.advanceTimersByTime(5_000);
    appStateHandler('active');
    jest.advanceTimersByTime(BACKGROUND_DISCONNECT_MS * 2);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(invalidator.all).not.toHaveBeenCalled();
  });

  it('dispose closes the socket', () => {
    const { socket, realtime } = setup();
    realtime.connect();
    realtime.dispose();
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
