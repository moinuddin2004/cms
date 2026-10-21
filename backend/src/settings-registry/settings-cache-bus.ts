import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { createRedisConnection } from 'src/common/redis/redis-connection';
import { ConfigScope } from './entities/config-value.entity';

export const SETTINGS_INVALIDATE_CHANNEL = 'settings-registry:invalidate';

export interface ScopeRef {
  scopeType: ConfigScope;
  scopeId: string | null;
}

/** Cross-instance cache invalidation for the settings registry. */
export abstract class SettingsCacheBus {
  /** Tell every other instance to drop this scope from its cache. */
  abstract publish(scope: ScopeRef): Promise<void>;
  abstract onInvalidate(handler: (scope: ScopeRef) => void): void;
}

/**
 * Redis pub/sub implementation. Publishing is best effort: when Redis is
 * down the other instances fall back to the cache TTL in
 * `SettingsRegistryService`.
 */
@Injectable()
export class RedisSettingsCacheBus
  extends SettingsCacheBus
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisSettingsCacheBus.name);
  private pub: Redis;
  private sub: Redis;
  private readonly handlers: ((scope: ScopeRef) => void)[] = [];

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    this.pub = createRedisConnection(url, 'settings-pub', this.logger);
    this.sub = createRedisConnection(url, 'settings-sub', this.logger, {
      autoResubscribe: false, // resubscribed on every 'ready' below
    });
    this.sub.on('ready', () => {
      this.sub
        .subscribe(SETTINGS_INVALIDATE_CHANNEL)
        .catch((err: Error) =>
          this.logger.warn(`Settings SUBSCRIBE failed: ${err.message}`),
        );
    });
    this.sub.on('message', (_channel: string, raw: string) => {
      let scope: ScopeRef;
      try {
        scope = JSON.parse(raw) as ScopeRef;
      } catch {
        return;
      }
      for (const h of this.handlers) h(scope);
    });
  }

  async onApplicationShutdown() {
    await Promise.all([
      this.pub?.quit().catch(() => undefined),
      this.sub?.quit().catch(() => undefined),
    ]);
  }

  async publish(scope: ScopeRef): Promise<void> {
    if (this.pub?.status !== 'ready') return;
    await this.pub
      .publish(SETTINGS_INVALIDATE_CHANNEL, JSON.stringify(scope))
      .catch(() => undefined);
  }

  onInvalidate(handler: (scope: ScopeRef) => void): void {
    this.handlers.push(handler);
  }
}
