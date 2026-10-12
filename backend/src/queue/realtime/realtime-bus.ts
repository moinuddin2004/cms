/**
 * Worker → API realtime bus.
 *
 * The worker's outbox relay PUBLISHes each committed outbox row to one Redis
 * channel; every API instance SUBSCRIBEs and emits it to its own local
 * Socket.IO rooms. That is the same fan-out the Socket.IO Redis adapter +
 * emitter would give, but the publish is awaited, so the relay only stamps
 * `published_at` once Redis has accepted the message (at-least-once).
 *
 * The worker also sends a heartbeat; an API instance that has not heard one
 * recently (Redis or worker down) refuses/drops sockets so clients fall back
 * to polling instead of silently missing events.
 */
export const REALTIME_CHANNEL = 'dentalflow:queue:realtime';

export const HEARTBEAT_EVERY_MS = 5_000;
/** API treats the bus as down after this long without a heartbeat. */
export const HEARTBEAT_STALE_MS = 3 * HEARTBEAT_EVERY_MS;

export interface OutboxMessagePayload {
  topic: string;
  payload: Record<string, unknown>;
}

export type BusMessage =
  | ({ kind: 'event' } & OutboxMessagePayload)
  | { kind: 'heartbeat'; at: number };

/** Where the outbox relay hands committed messages. Must throw if they were not accepted. */
export interface RealtimePublisher {
  publish(messages: OutboxMessagePayload[]): Promise<void>;
}

export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');
