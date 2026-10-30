import { Logger } from '@nestjs/common';
import { Redis, RedisOptions } from 'ioredis';

/**
 * A Redis connection that fails fast instead of buffering: commands issued
 * while disconnected reject immediately (no offline queue), so callers can
 * keep data in Postgres and retry. Reconnects forever with a capped backoff
 * and logs only state changes, not every failed attempt.
 *
 * Callers that are optional (the cache-invalidation buses) skip Redis when
 * `REDIS_URL` is unset; the split `api`/`worker` roles require it
 * (`assertRedisForRole`).
 */
export function createRedisConnection(
  url: string,
  name: string,
  logger: Logger,
  options: RedisOptions = {},
): Redis {
  const redis = new Redis(url, {
    connectionName: name,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: 5_000,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
    ...options,
  });
  let down = false;
  redis.on('ready', () => {
    if (down) logger.log(`Redis (${name}) reconnected`);
    down = false;
  });
  redis.on('error', (err) => {
    if (!down) logger.warn(`Redis (${name}) unavailable: ${err.message}`);
    down = true;
  });
  return redis;
}
