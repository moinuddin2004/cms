import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { env } from '@/core/env';

import type { RealtimeInvalidator, QueueRealtimeEvent } from './realtime-invalidation';

/** Docs/02 §7: the socket is closed this long after the app goes to the background. */
export const BACKGROUND_DISCONNECT_MS = 30_000;

/**
 * The staff socket to `/realtime` (docs/07 §2.6). `auth` is a function so
 * every (re)connect handshake carries the CURRENT access token.
 */
export function createStaffSocket(getToken: () => string | null): Socket {
  return io(`${env.apiUrl}/realtime`, {
    transports: ['websocket'],
    auth: (cb) => cb({ token: getToken() ?? '' }),
    reconnectionDelayMax: 10_000,
    autoConnect: false,
  });
}

type NotificationHandler = (e: { id?: string; title?: string }) => void;

export interface StaffRealtimeDeps {
  getToken: () => string | null;
  /** Staff `refreshSession` (resolves null when signed out, throws offline). */
  refreshSession: () => Promise<unknown>;
  invalidator: RealtimeInvalidator;
  /** In-app toast for `notification.new` (the provider decides foreground / screen). */
  onNotification?: NotificationHandler;
  /** Test seam. */
  createSocket?: (getToken: () => string | null) => Socket;
}

/**
 * Plain (non-React) controller around the socket: connection lifecycle, room
 * bookkeeping, and event → invalidation wiring. It only ever invalidates
 * queries (A-07).
 */
export class StaffRealtime {
  private socket: Socket | null = null;
  private readonly rooms = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private everConnected = false;
  private authRetried = false;
  private tokenUsed: string | null = null;
  private backgroundTimer: ReturnType<typeof setTimeout> | null = null;
  private backgroundedAt: number | null = null;
  private disposed = false;

  private onNotification: NotificationHandler | undefined;

  constructor(private readonly deps: StaffRealtimeDeps) {
    this.onNotification = deps.onNotification;
  }

  setOnNotification(handler: NotificationHandler | undefined): void {
    this.onNotification = handler;
  }

  // ---------- external store (useSyncExternalStore) ----------
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** True while the socket is connected and the server accepted our token. */
  isConnected = (): boolean => this.connected;

  private setConnected(next: boolean) {
    if (this.connected === next) return;
    this.connected = next;
    this.listeners.forEach((l) => l());
  }

  // ---------- connection ----------
  connect(): void {
    if (this.disposed) return;
    if (this.socket) {
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return;
    }
    const socket = (this.deps.createSocket ?? createStaffSocket)(this.deps.getToken);
    this.socket = socket;
    this.tokenUsed = this.deps.getToken();

    socket.on('connect', () => {
      this.tokenUsed = this.deps.getToken();
      this.setConnected(true);
      this.rooms.forEach((_n, room) => this.emitSubscribe(room));
      // A reconnect: events may have been missed while we were away.
      if (this.everConnected) this.deps.invalidator.all();
      this.everConnected = true;
    });
    socket.on('disconnect', () => this.setConnected(false));
    socket.on('connect_error', () => this.setConnected(false));
    socket.on('auth_error', () => this.onAuthError());
    socket.on('queue.event', (e: QueueRealtimeEvent) => this.deps.invalidator.queueEvent(e));
    socket.on('access.changed', () => this.deps.invalidator.accessChanged());
    socket.on('notification.new', (e: { id?: string; title?: string }) => {
      this.deps.invalidator.notificationNew();
      this.onNotification?.(e);
    });
    socket.connect();
  }

  /** Close the socket (background / sign-out) and forget nothing: rooms are re-joined on connect. */
  disconnect(): void {
    this.socket?.disconnect();
    this.setConnected(false);
  }

  /** Drop the connection and open a new one (fresh token). */
  reconnect(): void {
    if (!this.socket) return this.connect();
    this.socket.disconnect();
    this.socket.connect();
  }

  /** Reconnect only when the access token changed since this connection's handshake. */
  reconnectIfTokenChanged(): void {
    if (this.socket && this.deps.getToken() !== this.tokenUsed) this.reconnect();
  }

  /**
   * The server accepted the socket but refused the token. Refresh the session
   * once, then reconnect; if that does not help, stay down until the next
   * foreground (no loop).
   */
  private onAuthError(): void {
    this.setConnected(false);
    if (this.authRetried) return;
    this.authRetried = true;
    this.deps
      .refreshSession()
      .then((session) => {
        if (session && !this.disposed) this.reconnect();
      })
      .catch(() => {
        /* offline: the next foreground reconnects */
      });
  }

  // ---------- rooms ----------
  /** Join a room (counted: screens may share one). Returns the matching leave. */
  joinRoom(room: string): () => void {
    const n = this.rooms.get(room) ?? 0;
    this.rooms.set(room, n + 1);
    if (n === 0) this.emitSubscribe(room);
    let left = false;
    return () => {
      if (left) return;
      left = true;
      const count = (this.rooms.get(room) ?? 1) - 1;
      if (count > 0) {
        this.rooms.set(room, count);
        return;
      }
      this.rooms.delete(room);
      if (this.socket?.connected) this.socket.emit('unsubscribe', { room });
    };
  }

  private emitSubscribe(room: string): void {
    const socket = this.socket;
    if (!socket?.connected) return; // joined on the next 'connect'
    socket.emit('subscribe', { room }, (ack?: { ok?: boolean }) => {
      // An accepted org room proves the token was good: allow a future auth retry.
      if (ack?.ok && room.startsWith('org:')) {
        this.authRetried = false;
        this.setConnected(true);
      }
    });
  }

  // ---------- app lifecycle ----------
  /** Wire AppState: close 30 s after background, reopen (and refresh) on foreground. */
  attachAppLifecycle(): () => void {
    const onChange = (state: AppStateStatus) => {
      if (state === 'background') {
        this.backgroundedAt ??= Date.now();
        this.backgroundTimer ??= setTimeout(() => {
          this.backgroundTimer = null;
          this.disconnect();
        }, BACKGROUND_DISCONNECT_MS);
      } else if (state === 'active') {
        if (this.backgroundTimer) clearTimeout(this.backgroundTimer);
        this.backgroundTimer = null;
        const awayMs = this.backgroundedAt === null ? 0 : Date.now() - this.backgroundedAt;
        this.backgroundedAt = null;
        this.authRetried = false;
        if (!this.socket?.connected) {
          this.connect(); // 'connect' invalidates all once
        } else if (awayMs >= BACKGROUND_DISCONNECT_MS) {
          this.deps.invalidator.all();
        }
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      if (this.backgroundTimer) clearTimeout(this.backgroundTimer);
      this.backgroundTimer = null;
    };
  }

  dispose(): void {
    this.disposed = true;
    if (this.backgroundTimer) clearTimeout(this.backgroundTimer);
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.rooms.clear();
    this.connected = false;
    this.listeners.clear();
  }
}
