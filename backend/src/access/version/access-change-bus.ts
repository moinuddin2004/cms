import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { createRedisConnection } from 'src/common/redis/redis-connection';

/** One Redis channel for every org; the payload names the org. */
export const ACCESS_CHANGED_CHANNEL = 'dentalflow:access:changed';

/** An org's `access_version` moved: every cache keyed on the old one is stale. */
export interface AccessChange {
  organizationId: string;
  version: number;
}

type Listener = (change: AccessChange) => void;

interface WireMessage extends AccessChange {
  origin: string;
}

/**
 * Cross-process "access changed" bus (API instances + worker).
 *
 * `publish` notifies this process's listeners synchronously, then PUBLISHes
 * to Redis; every other process gets it through its SUBSCRIBE and notifies
 * its own listeners (messages from this instance are ignored, they were
 * already delivered). Listeners: the feature-flag cache, the access-context
 * cache, and the Socket.IO gateway (`access.changed` to the org room).
 *
 * Redis down → only this process hears about the change; the other caches
 * catch up through their TTLs (see AccessVersionService / FeatureFlagsService).
 */
@Injectable()
export class AccessChangeBus implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AccessChangeBus.name);
  private readonly instanceId = randomUUID();
  private readonly listeners = new Set<Listener>();
  private pub: Redis | null = null;
  private sub: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    this.pub = createRedisConnection(url, 'access-bus-pub', this.logger);
    this.sub = createRedisConnection(url, 'access-bus-sub', this.logger, {
      autoResubscribe: false, // resubscribed on every 'ready' below
    });
    this.sub.on('ready', () => {
      this.sub
        ?.subscribe(ACCESS_CHANGED_CHANNEL)
        .catch((err: Error) =>
          this.logger.warn(`Access bus SUBSCRIBE failed: ${err.message}`),
        );
    });
    this.sub.on('message', (_channel: string, raw: string) =>
      this.onMessage(raw),
    );
  }

  async onApplicationShutdown() {
    await Promise.all(
      [this.pub, this.sub].map(async (r) => {
        await r?.quit().catch(() => undefined);
        r?.disconnect(); // also stops a pending reconnect when Redis was down
      }),
    );
  }

  /** Subscribe to changes (this process and others). Returns an unsubscribe. */
  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Tell this process now and the other processes via Redis (best effort). */
  async publish(change: AccessChange): Promise<void> {
    this.deliver(change);
    if (this.pub?.status !== 'ready') return;
    const message: WireMessage = { ...change, origin: this.instanceId };
    await this.pub
      .publish(ACCESS_CHANGED_CHANNEL, JSON.stringify(message))
      .catch((err: Error) =>
        this.logger.warn(`Access bus PUBLISH failed: ${err.message}`),
      );
  }

  /** Handles one raw Redis message (exposed for tests). */
  onMessage(raw: string) {
    let msg: Partial<WireMessage>;
    try {
      msg = JSON.parse(raw) as Partial<WireMessage>;
    } catch {
      return;
    }
    if (msg.origin === this.instanceId) return;
    if (typeof msg.organizationId !== 'string') return;
    if (typeof msg.version !== 'number') return;
    this.deliver({ organizationId: msg.organizationId, version: msg.version });
  }

  private deliver(change: AccessChange) {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (err) {
        this.logger.error(
          `Access change listener failed: ${(err as Error).message}`,
        );
      }
    }
  }
}
