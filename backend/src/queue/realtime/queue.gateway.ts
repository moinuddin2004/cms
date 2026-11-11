import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { assertStaffAudience } from 'src/auth/staff-audience';
import { QueueSession } from '../entities/queue-session.entity';
import { Location } from 'src/locations/entities/location.entity';
import {
  AccessChange,
  AccessChangeBus,
} from 'src/access/version/access-change-bus';
import { userRoom } from 'src/notifications/notification-realtime';
import { allowedOrigins } from 'src/common/cors';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SESSION_ROOM = new RegExp(`^session:(${UUID})$`, 'i');
const BOARD_ROOM = new RegExp(`^location:(${UUID}):board$`, 'i');
const DISPLAY_ROOM = new RegExp(`^location:(${UUID}):display$`, 'i');
const ORG_ROOM = new RegExp(`^org:(${UUID})$`, 'i');

/** Org-wide room name: every signed-in member of the org may join. */
export const orgRoom = (organizationId: string) => `org:${organizationId}`;

/**
 * Whether this instance can deliver events right now. Engine-level, so a
 * refused handshake is a transport error and socket.io-client keeps
 * reconnecting on its own (a namespace-middleware refusal would not).
 */
const availability = { open: true };

/**
 * Socket.IO gateway at `/realtime`. Clients connect (JWT in
 * `handshake.auth.token`), then `subscribe` to rooms:
 * - `session:<id>` — one doctor's queue (doctor screen, reception)
 * - `location:<id>:board` — every queue at a location (reception board)
 * - `location:<id>:display` — TV display; no login needed, payloads never
 *   carry patient names
 * - `user:<id>` — joined automatically on an authenticated connect (never
 *   via `subscribe`); carries `notification.new` for the bell.
 * - `org:<id>` — org-wide; any user with access to the org (super admin,
 *   owner, active portal assignment). Carries `access.changed`
 *   `{ organizationId, version }` whenever the org's access_version moves:
 *   clients refetch `GET /me/access`.
 *
 * Events are nudges with `seq`: clients keep their snapshot's `eventSeq`,
 * ignore older/duplicate seqs, and refetch the snapshot on anything newer.
 */
@WebSocketGateway({
  namespace: '/realtime',
  // Web app origin(s) from CORS_ORIGIN, plus the Tauri desktop shell.
  cors: { origin: allowedOrigins(), credentials: true },
  // Behind a load balancer with 2+ API instances, long-polling needs sticky
  // sessions; the web app connects with websocket only.
  transports: ['websocket', 'polling'],
  allowRequest: (_req, callback) =>
    callback(availability.open ? null : 'Realtime temporarily unavailable', availability.open),
})
export class QueueGateway
  implements OnGatewayConnection, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(QueueGateway.name);
  private stopAccessListener: (() => void) | null = null;

  @WebSocketServer() server: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authorization: AuthorizationService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() private readonly accessBus?: AccessChangeBus,
  ) {}

  onModuleInit() {
    // Every instance hears every change (bus over Redis) and tells its own sockets.
    this.stopAccessListener =
      this.accessBus?.onChange((c) => this.emitAccessChanged(c)) ?? null;
  }

  onModuleDestroy() {
    this.stopAccessListener?.();
  }

  /** `access.changed` to this instance's sockets in the org room. */
  private emitAccessChanged(c: AccessChange) {
    const payload = { organizationId: c.organizationId, version: c.version };
    this.server?.to(orgRoom(c.organizationId)).emit('access.changed', payload);
  }

  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth?.token;
    socket.data.userId = null;
    if (!token) return; // display screens connect anonymously
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        aud?: unknown;
      }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      // `/realtime` is the staff socket. A patient token (or any other
      // audience) must never get a room here.
      assertStaffAudience(payload);
      socket.data.userId = payload.sub;
      // Personal room for in-app notifications (`notification.new`). Joined
      // here only — `subscribe` refuses `user:*`, so nobody joins another's.
      await socket.join(userRoom(payload.sub));
    } catch {
      socket.emit('auth_error', { message: 'Invalid or expired token' });
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: string }) {
    const room = String(body?.room ?? '');

    if (DISPLAY_ROOM.test(room)) {
      await socket.join(room);
      return { ok: true, room };
    }

    const userId: string | null = socket.data.userId;
    if (!userId) return { ok: false, room, error: 'Sign in required for this room' };

    const orgMatch = room.match(ORG_ROOM);
    if (orgMatch) {
      if (
        !(await this.authorization.canAccessOrganization(userId, orgMatch[1]))
      ) {
        return { ok: false, room, error: 'No access to this room' };
      }
      await socket.join(room);
      return { ok: true, room };
    }

    let organizationId: string | null = null;
    let locationId: string | null = null;
    const sessionMatch = room.match(SESSION_ROOM);
    const boardMatch = room.match(BOARD_ROOM);
    if (sessionMatch) {
      const s = await this.dataSource.getRepository(QueueSession).findOne({
        where: { id: sessionMatch[1] },
        select: { id: true, organizationId: true, locationId: true },
      });
      organizationId = s?.organizationId ?? null;
      locationId = s?.locationId ?? null;
    } else if (boardMatch) {
      const l = await this.dataSource.getRepository(Location).findOne({
        where: { id: boardMatch[1] },
        select: { id: true, organizationId: true },
      });
      organizationId = l?.organizationId ?? null;
      locationId = l?.id ?? null;
    } else {
      return { ok: false, room, error: 'Unknown room' };
    }

    if (
      !organizationId ||
      !locationId ||
      !(await this.authorization.validateAccess(userId, organizationId, locationId))
    ) {
      return { ok: false, room, error: 'No access to this room' };
    }
    await socket.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: string }) {
    if (body?.room) await socket.leave(String(body.room));
    return { ok: true };
  }

  /**
   * Emit one committed outbox message to this instance's sockets in `topic`.
   * Called by the Redis subscriber (api role) or the relay directly (all role).
   */
  publish(topic: string, payload: Record<string, unknown>) {
    if (!this.server) return;
    const type = typeof payload.type === 'string' ? payload.type : 'queue.event';
    this.server.to(topic).emit(type, payload);
  }

  /**
   * Open/close this instance for realtime. Closing drops the transport of
   * every connected socket (not a server "disconnect", which clients would
   * not retry), so clients fall back to polling and reconnect + refetch once
   * it reopens.
   */
  setAvailable(open: boolean) {
    if (availability.open === open) return;
    availability.open = open;
    if (!open && this.server) {
      for (const socket of this.server.sockets.values()) socket.conn.close();
    }
  }
}
