import { Logger } from '@nestjs/common';
import { Redis, RedisOptions } from 'ioredis';

export const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/**
 * A Redis connection that fails fast instead of buffering: commands issued
 * while disconnected reject immediately (no offline queue), so callers can
 * keep data in Postgres and retry. Reconnects forever with a capped backoff
 * and logs only state changes, not every failed attempt.
 */
export function createRedisConnection(
  url: string | undefined,
  name: string,
  logger: Logger,
  options: RedisOptions = {},
): Redis {
  const redis = new Redis(url || DEFAULT_REDIS_URL, {
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
