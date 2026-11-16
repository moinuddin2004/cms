import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { env } from '@/core/env';
import { log } from '@/core/log';

import type { PatientInvalidator } from './realtime-invalidation';

/** Docs/02 §7: the socket is closed this long after the app goes to the background. */
export const BACKGROUND_DISCONNECT_MS = 30_000;

/** First wait before re-opening a socket the server closed; doubles up to the cap. */
export const RECONNECT_BASE_MS = 2_000;
export const RECONNECT_MAX_MS = 30_000;

/** A refused subscribe (the server may still be verifying our token) is retried this often. */
export const SUBSCRIBE_RETRY_MS = [500, 1_500, 4_000, 10_000];

/** Exponential backoff with a cap: 2 s, 4 s, 8 s … 30 s. Exported for tests. */
export function reconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.max(0, attempt));
}

/**
 * The patient socket to `/patient-realtime` (docs/07 §7). `auth` is a function so every
 * (re)connect handshake carries the CURRENT access token.
 */
export function createPatientSocket(getToken: () => string | null): Socket {
  return io(`${env.apiUrl}/patient-realtime`, {
    transports: ['websocket'],
    auth: (cb) => cb({ token: getToken() ?? '' }),
    reconnectionDelayMax: 10_000,
    autoConnect: false,
  });
}

export const entryRoom = (entryId: string) => `entry:${entryId}`;

export interface PatientRealtimeDeps {
  getToken: () => string | null;
  invalidator: PatientInvalidator;
  /**
   * Patient `refreshSession` (single-flight; resolves null when the server rejected the refresh
   * token, throws offline). Called once per `auth_error` so the reconnect carries a fresh token.
   * The socket never signs out itself: what the refresh does with a dead session is the HTTP
   * layer's decision.
   */
  refreshSession?: () => Promise<unknown>;
  /** Test seam. */
  createSocket?: (getToken: () => string | null) => Socket;
}

/**
 * Plain (non-React) controller around the patient socket: connection lifecycle, entry-room
 * bookkeeping, event → invalidation wiring. It ONLY invalidates queries (A-07) and NEVER
 * signs the user out: a socket error means "not live" — screens poll — and nothing else. The
 * token is refreshed by the HTTP client (the polling / refetch requests do that); this class
 * just reconnects with backoff and the `auth` callback then reads whatever token is current.
 */
export class PatientRealtime {
  private socket: Socket | null = null;
  private readonly rooms = new Map<string, number>();
  private readonly acked = new Set<string>();
  private readonly retries = new Map<string, number>();
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly listeners = new Set<() => void>();
  private live = false;
  private everConnected = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backgroundTimer: ReturnType<typeof setTimeout> | null = null;
  private backgroundedAt: number | null = null;
  private disposed = false;

  constructor(private readonly deps: PatientRealtimeDeps) {}

  // ---------- external store (useSyncExternalStore) ----------
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * True only while the socket is connected AND the server accepted a subscribe for one of
   * our rooms (the proof that our token was good). Everything else means "poll".
   */
  isLive = (): boolean => this.live;

  private setLive(next: boolean) {
    if (this.live === next) return;
    this.live = next;
    this.listeners.forEach((l) => l());
  }

  // ---------- connection ----------
  connect(): void {
    // Reversible: a second effect run (StrictMode / Fast Refresh) after dispose() reconnects.
    this.disposed = false;
    if (this.socket) {
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return;
    }
    const socket = (this.deps.createSocket ?? createPatientSocket)(this.deps.getToken);
    this.socket = socket;

    socket.on('connect', () => {
      this.acked.clear();
      this.retries.clear();
      this.rooms.forEach((_n, room) => this.emitSubscribe(room));
      // A reconnect: events may have been missed while we were away.
      if (this.everConnected) this.deps.invalidator.all();
      this.everConnected = true;
    });
    // `io server disconnect` (a refused token / server down) never auto-reconnects: we do.
    socket.on('disconnect', (reason?: string) => this.onDown(reason === 'io server disconnect'));
    socket.on('connect_error', () => this.onDown(false));
    socket.on('auth_error', () => this.onAuthError());
    socket.on('unavailable', (e?: { retryAfterSeconds?: number }) => this.onUnavailable(e));
    socket.on('visit.event', (e: { entryId?: string; seq?: number }) =>
      this.deps.invalidator.visitEvent(e),
    );
    socket.on('feed.changed', (e: { kinds?: string[] }) => this.deps.invalidator.feedChanged(e));
    socket.connect();
  }

  /** Close the socket (background / sign-out) and forget nothing: rooms are re-joined on connect. */
  disconnect(): void {
    this.clearReconnect();
    this.socket?.disconnect();
    this.acked.clear();
    this.setLive(false);
  }

  /** Down: not live (screens poll). If the server closed it on us, retry with backoff. */
  private onDown(needsManualReconnect: boolean): void {
    this.acked.clear();
    this.setLive(false);
    // Anything that changed while we were not listening is fetched once through the poll/refetch.
    this.deps.invalidator.all();
    if (!needsManualReconnect || this.disposed) return;
    this.scheduleReconnect();
  }

  /** The access token was refused or expired: refresh once, then reconnect (backoff if it fails). */
  private onAuthError(): void {
    this.onDown(false);
    const refresh = this.deps.refreshSession;
    if (!refresh || this.disposed) return this.scheduleReconnect();
    void refresh()
      .catch(() => undefined) // offline: the backoff below retries
      .finally(() => this.scheduleReconnect(this.attempt === 0 ? 0 : undefined));
  }

  /** Bus down: the session is fine. Poll, and come back after the server's suggested wait. */
  private onUnavailable(e?: { retryAfterSeconds?: number }): void {
    this.onDown(false);
    const s = e?.retryAfterSeconds;
    this.scheduleReconnect(
      typeof s === 'number' && s > 0 ? Math.min(RECONNECT_MAX_MS, s * 1000) : undefined,
    );
  }

  private scheduleReconnect(delayMs?: number): void {
    if (this.reconnectTimer) return;
    const wait = delayMs ?? reconnectDelay(this.attempt);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disposed || !this.socket) return;
      this.socket.disconnect();
      this.socket.connect();
    }, wait);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  // ---------- rooms ----------
  /** Watch one queue entry while the caller is mounted (counted). Returns the matching leave. */
  watchEntry(entryId: string): () => void {
    const room = entryRoom(entryId);
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
      this.acked.delete(room);
      this.cancelRetry(room);
      if (this.socket?.connected) this.socket.emit('unsubscribe', { room });
      if (this.acked.size === 0) this.setLive(false);
    };
  }

  private emitSubscribe(room: string): void {
    const socket = this.socket;
    if (!socket?.connected) return; // joined on the next 'connect'
    socket.emit('subscribe', { room }, (ack?: { ok?: boolean }) => {
      if (!this.rooms.has(room)) return;
      if (ack?.ok) {
        this.retries.delete(room);
        this.acked.add(room);
        this.attempt = 0;
        this.setLive(true);
        return;
      }
      // Not accepted: our token may still be verified server side (the handshake finishes after
      // the first packets), or the entry is no longer ours. Try a few times, keep polling meanwhile.
      this.retrySubscribe(room);
    });
  }

  private retrySubscribe(room: string): void {
    const tries = this.retries.get(room) ?? 0;
    const wait = SUBSCRIBE_RETRY_MS[tries];
    if (wait === undefined) {
      log.warn('patient realtime: subscribe refused');
      return;
    }
    this.retries.set(room, tries + 1);
    this.cancelRetry(room);
    this.retryTimers.set(
      room,
      setTimeout(() => {
        this.retryTimers.delete(room);
        if (this.rooms.has(room)) this.emitSubscribe(room);
      }, wait),
    );
  }

  private cancelRetry(room: string): void {
    const t = this.retryTimers.get(room);
    if (t) clearTimeout(t);
    this.retryTimers.delete(room);
    this.retries.delete(room);
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
        this.attempt = 0;
        this.clearReconnect();
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
    this.clearReconnect();
    if (this.backgroundTimer) clearTimeout(this.backgroundTimer);
    this.retryTimers.forEach((t) => clearTimeout(t));
    this.retryTimers.clear();
    this.retries.clear();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.rooms.clear();
    this.acked.clear();
    this.live = false;
    this.everConnected = false;
    this.attempt = 0;
    this.listeners.forEach((l) => l());
  }
}
