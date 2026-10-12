import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { createRedisConnection } from 'src/common/redis/redis-connection';
import {
  BusMessage,
  HEARTBEAT_EVERY_MS,
  OutboxMessagePayload,
  REALTIME_CHANNEL,
  RealtimePublisher,
} from './realtime-bus';

/** Worker side: publishes outbox messages + heartbeats to the Redis bus. */
@Injectable()
export class RedisRealtimePublisher implements RealtimePublisher, OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisRealtimePublisher.name);
  private redis: Redis;
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.redis = createRedisConnection(this.config.get<string>('REDIS_URL'), 'queue-relay-pub', this.logger);
    this.heartbeat = setInterval(() => void this.beat(), HEARTBEAT_EVERY_MS);
    this.redis.on('ready', () => void this.beat());
  }

  async onApplicationShutdown() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    await this.redis?.quit().catch(() => undefined);
  }

  /** Rejects unless Redis accepted every message — the relay then retries the batch. */
  async publish(messages: OutboxMessagePayload[]): Promise<void> {
    if (!messages.length) return;
    if (this.redis.status !== 'ready') throw new Error(`Redis not ready (${this.redis.status})`);
    const pipeline = this.redis.pipeline();
    for (const m of messages) pipeline.publish(REALTIME_CHANNEL, encode({ kind: 'event', ...m }));
    const results = (await pipeline.exec()) ?? [];
    const failed = results.find(([err]) => err);
    if (failed || results.length !== messages.length) {
      throw new Error(`Redis publish failed: ${failed?.[0]?.message ?? 'incomplete pipeline'}`);
    }
  }

  private async beat() {
    if (this.redis.status !== 'ready') return;
    await this.redis
      .publish(REALTIME_CHANNEL, encode({ kind: 'heartbeat', at: Date.now() }))
      .catch(() => undefined);
  }
}

const encode = (m: BusMessage) => JSON.stringify(m);
