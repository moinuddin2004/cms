import { ConflictException } from '@nestjs/common';

/**
 * Optimistic lock check: the client edited version `expected`, the row is
 * now at `current`. The caller must already hold the row lock (FOR UPDATE),
 * so nothing can change between this check and the write. Clients read
 * `error.code === 'STALE_VERSION'`, reload, and retry.
 */
export function assertVersion(current: number, expected: number): void {
  if (current !== expected) {
    throw new ConflictException({
      code: 'STALE_VERSION',
      message: 'Someone else changed this record. Reload and try again.',
      currentVersion: current,
    });
  }
}
