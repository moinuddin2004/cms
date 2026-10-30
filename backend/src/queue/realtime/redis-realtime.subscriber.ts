import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { createRedisConnection } from 'src/common/redis/redis-connection';
import { QueueGateway } from './queue.gateway';
import { BusMessage, HEARTBEAT_EVERY_MS, HEARTBEAT_STALE_MS, REALTIME_CHANNEL } from './realtime-bus';

/**
 * API side: receives the worker's messages from Redis and emits them to this
 * instance's sockets. Every API instance gets every message, so a client
 * connected to any instance sees every event.
 *
 * Sockets are only accepted while the bus is healthy (subscribed and a
 * worker heartbeat seen recently). Otherwise the gateway refuses/drops them
 * and clients poll every 10 s until it recovers; on reconnect they refetch.
 */
@Injectable()
export class RedisRealtimeSubscriber implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisRealtimeSubscriber.name);
  private redis: Redis;
  private subscribed = false;
  private lastHeartbeat = 0;
  private watchdog: NodeJS.Timeout | null = null;
  private healthy: boolean | null = null;

  constructor(
    private readonly gateway: QueueGateway,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.gateway.setAvailable(false); // until the first heartbeat arrives
    this.redis = createRedisConnection(this.config.getOrThrow<string>('REDIS_URL'), 'queue-realtime-sub', this.logger, {
      autoResubscribe: false, // we resubscribe on every 'ready' ourselves
    });
    this.redis.on('ready', () => void this.subscribe());
    this.redis.on('close', () => {
      this.subscribed = false;
      this.check();
    });
    this.redis.on('message', (_channel: string, raw: string) => this.onMessage(raw));
    this.watchdog = setInterval(() => this.check(), HEARTBEAT_EVERY_MS);
  }

  async onApplicationShutdown() {
    if (this.watchdog) clearInterval(this.watchdog);
    await this.redis?.quit().catch(() => undefined);
  }

  private async subscribe() {
    try {
      await this.redis.subscribe(REALTIME_CHANNEL);
      this.subscribed = true;
    } catch (err) {
      this.logger.warn(`Realtime SUBSCRIBE failed: ${(err as Error).message}`);
    }
  }

  private onMessage(raw: string) {
    let msg: BusMessage;
    try {
      msg = JSON.parse(raw) as BusMessage;
    } catch {
      return;
    }
    if (msg.kind === 'heartbeat') {
      this.lastHeartbeat = Date.now();
      this.check();
    } else if (msg.kind === 'event') {
      this.gateway.publish(msg.topic, msg.payload);
    }
  }

  private check() {
    const healthy = this.subscribed && Date.now() - this.lastHeartbeat < HEARTBEAT_STALE_MS;
    if (healthy === this.healthy) return;
    this.healthy = healthy;
    this.gateway.setAvailable(healthy);
    if (healthy) this.logger.log('Realtime bus healthy — accepting sockets');
    else this.logger.warn('Realtime bus down (Redis or worker) — sockets refused, clients poll');
  }
}
