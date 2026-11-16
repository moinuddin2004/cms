import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { allowedOrigins } from 'src/common/cors';
import { PatientSessionEvents } from 'src/patient-auth/patient-session-events';
import { PatientSessionService } from 'src/patient-auth/patient-session.service';
import { PatientTokenService } from 'src/patient-auth/patient-token.service';
import { PatientQueueService } from '../queue/patient-queue.service';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ENTRY_ROOM = new RegExp(`^entry:(${UUID})$`, 'i');
const MAX_ENTRY_ROOMS = 20;
/** Sockets one account may hold at once; the oldest are dropped. */
export const MAX_SOCKETS_PER_ACCOUNT = 5;
const MAX_TIMER_MS = 2_147_000_000;

export const patientRoom = (accountId: string) => `patient:${accountId}`;
export const entryRoom = (entryId: string) => `entry:${entryId}`;

/**
 * Socket.IO namespace `/patient-realtime` (07 §7). Separate from the staff
 * `/realtime`: it verifies the PATIENT secret + `aud: 'patient'` and a live
 * session, so a staff token is refused here (and a patient token is refused
 * there). The server puts the socket in `patient:<accountId>`; the client may
 * `subscribe { room: 'entry:<id>' }` only for an entry of a patient in the
 * account's live links, re-checked on every subscribe and whenever a link
 * changes. Payloads are nudges (`visit.event { entryId, seq }`,
 * `feed.changed`): the app refetches over HTTP.
 */
@WebSocketGateway({
  namespace: '/patient-realtime',
  cors: { origin: allowedOrigins(), credentials: true },
  transports: ['websocket', 'polling'],
})
export class PatientRealtimeGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger = new Logger(PatientRealtimeGateway.name);
  private open = true;
  /** queue session → entries that have (had) a subscriber on this instance. */
  private readonly sessionEntries = new Map<string, Set<string>>();

  @WebSocketServer() server: Namespace;

  constructor(
    private readonly tokens: PatientTokenService,
    private readonly sessions: PatientSessionService,
    private readonly queue: PatientQueueService,
    private readonly sessionEvents?: PatientSessionEvents,
  ) {}

  private stopEvents: (() => void) | null = null;

  onModuleInit() {
    this.stopEvents =
      this.sessionEvents?.onRevoked(
        (e) => void this.disconnectAccount(e.accountId, e.sessionId),
      ) ?? null;
  }

  onModuleDestroy() {
    this.stopEvents?.();
  }

  handleDisconnect(socket: Socket) {
    clearTimeout(socket.data?.expiryTimer as NodeJS.Timeout | undefined);
  }

  /** Drop an account's sockets (one session, or all of them). */
  async disconnectAccount(accountId: string, sessionId?: string) {
    try {
      const sockets = await this.server
        .in(patientRoom(accountId))
        .fetchSockets();
      for (const s of sockets) {
        if (sessionId && s.data?.sessionId !== sessionId) continue;
        s.emit('auth_error', { message: 'Session ended' });
        s.disconnect(true);
      }
    } catch (err) {
      this.logger.warn(`Dropping sockets failed: ${(err as Error).message}`);
    }
  }

  /** Keep at most MAX_SOCKETS_PER_ACCOUNT sockets per account; the oldest go. */
  private async enforceCap(accountId: string) {
    if (!this.server) return;
    const sockets = await this.server
      .in(patientRoom(accountId))
      .fetchSockets();
    if (sockets.length <= MAX_SOCKETS_PER_ACCOUNT) return;
    sockets.sort(
      (a, b) =>
        Number(a.data?.connectedAt ?? 0) - Number(b.data?.connectedAt ?? 0),
    );
    for (const s of sockets.slice(0, sockets.length - MAX_SOCKETS_PER_ACCOUNT)) {
      s.emit('auth_error', { message: 'Too many connections' });
      s.disconnect(true);
    }
  }

  async handleConnection(socket: Socket) {
    if (!this.open) {
      // Not an auth failure: clients keep their session and poll instead.
      socket.emit('unavailable', { retryAfterSeconds: 10 });
      socket.disconnect(true);
      return;
    }
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('no token');
      const payload = await this.tokens.verify(token);
      if (!payload.sub || !payload.sid) throw new Error('bad payload');
      if (!(await this.sessions.isAlive(payload.sid, payload.sub))) {
        throw new Error('session ended');
      }
      socket.data.accountId = payload.sub;
      socket.data.sessionId = payload.sid;
      socket.data.connectedAt = Date.now();
      if (payload.exp) {
        // The socket must not outlive its access token; the client reconnects with a fresh one.
        const ms = Math.min(
          Math.max(payload.exp * 1000 - Date.now(), 0),
          MAX_TIMER_MS,
        );
        const timer = setTimeout(() => {
          socket.emit('auth_error', { message: 'Token expired' });
          socket.disconnect(true);
        }, ms);
        timer.unref?.();
        socket.data.expiryTimer = timer;
      }
      await socket.join(patientRoom(payload.sub));
      await this.enforceCap(payload.sub);
    } catch {
      socket.emit('auth_error', { message: 'Invalid or expired token' });
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { room?: string },
  ) {
    const room = String(body?.room ?? '');
    const accountId: string | undefined = socket.data?.accountId;
    const denied = { ok: false, room, error: 'NOT_FOUND' };
    if (!accountId) return denied;
    if (!(await this.sessions.isAlive(socket.data.sessionId, accountId))) {
      socket.emit('auth_error', { message: 'Session ended' });
      socket.disconnect(true);
      return denied;
    }
    const match = room.match(ENTRY_ROOM);
    if (!match) return denied;
    const entryId = match[1].toLowerCase();

    const have = [...socket.rooms].filter((r) => r.startsWith('entry:'));
    if (!have.includes(entryRoom(entryId)) && have.length >= MAX_ENTRY_ROOMS) {
      return denied;
    }
    const sessionId = await this.queue.subscribableSession(accountId, entryId);
    if (!sessionId) return denied;
    await socket.join(entryRoom(entryId));
    let set = this.sessionEntries.get(sessionId);
    if (!set) this.sessionEntries.set(sessionId, (set = new Set()));
    set.add(entryId);
    return { ok: true, room: entryRoom(entryId) };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { room?: string },
  ) {
    const room = String(body?.room ?? '');
    if (ENTRY_ROOM.test(room)) await socket.leave(room.toLowerCase());
    return { ok: true };
  }

  /**
   * One committed outbox message of this instance's relay/bus.
   * - `patient:<accountId>` topics (feed.changed, link events) go to that account;
   *   a `links` change also re-checks its entry subscriptions.
   * - `session:<id>` `queue.event` becomes `visit.event { entryId, seq }` for
   *   every subscribed entry of that session (a change moves everybody's place).
   * Everything else (board / display / org topics) is not for patients.
   */
  publish(topic: string, payload: Record<string, unknown>) {
    if (!this.server) return;
    if (topic.startsWith('patient:')) {
      const type = typeof payload.type === 'string' ? payload.type : 'feed.changed';
      this.server.to(topic).emit(type, payload);
      const kinds = payload.kinds;
      if (Array.isArray(kinds) && kinds.includes('links')) {
        void this.revalidate(topic.slice('patient:'.length));
      }
      return;
    }
    if (topic.startsWith('session:') && payload.type === 'queue.event') {
      const entries = this.sessionEntries.get(topic.slice('session:'.length));
      if (!entries) return;
      const seq = payload.seq;
      for (const entryId of [...entries]) {
        const room = entryRoom(entryId);
        if (!this.server.adapter.rooms.get(room)?.size) {
          entries.delete(entryId); // nobody listens any more
          continue;
        }
        this.server.to(room).emit('visit.event', { entryId, seq });
      }
      if (entries.size === 0) {
        this.sessionEntries.delete(topic.slice('session:'.length));
      }
    }
  }

  /** Drop entry rooms the account's links no longer cover (revoked / unlinked). */
  async revalidate(accountId: string) {
    try {
      const sockets = await this.server.in(patientRoom(accountId)).fetchSockets();
      for (const s of sockets) {
        for (const room of s.rooms) {
          const m = room.match(ENTRY_ROOM);
          if (!m) continue;
          if (!(await this.queue.subscribableSession(accountId, m[1]))) {
            s.leave(room);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Re-check of patient rooms failed: ${(err as Error).message}`);
    }
  }

  /** Mirror of the staff gateway: closed while the bus is down so clients poll. */
  setAvailable(open: boolean) {
    if (this.open === open) return;
    this.open = open;
    if (!open && this.server) {
      for (const socket of this.server.sockets.values()) socket.conn.close();
    }
  }
}
