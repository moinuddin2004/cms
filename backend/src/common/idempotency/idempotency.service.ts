import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';

/** sha256 of a stable JSON rendering — same request, same hash. */
export function requestHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Idempotency keys (lab ERD §8, invariant 10) on the shared
 * `idempotency_keys` table, namespaced `scope:key`. Must run inside the
 * transaction doing the work: the claim row commits or rolls back with it,
 * and a concurrent request with the same key waits on the row, then replays.
 */
@Injectable()
export class IdempotencyService {
  /** Null = first time (go ahead); otherwise the stored response to replay. */
  async claim(
    m: EntityManager,
    organizationId: string,
    scope: string,
    key: string,
    hash: string,
  ): Promise<{ response: unknown } | null> {
    const scoped = this.scoped(scope, key);
    const inserted = await sqlRows<{ key: string }>(
      m,
      `INSERT INTO idempotency_keys (organization_id, key, request_hash)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING key`,
      [organizationId, scoped, hash],
    );
    if (inserted.length) return null;

    const [row] = await sqlRows<{
      request_hash: string;
      response_status: number | null;
      response_body: unknown;
    }>(
      m,
      `SELECT request_hash, response_status, response_body FROM idempotency_keys
        WHERE organization_id = $1 AND key = $2`,
      [organizationId, scoped],
    );
    if (row.request_hash !== hash) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message:
          'This Idempotency-Key was already used for a different request',
      });
    }
    if (row.response_status == null) {
      throw new ConflictException({
        code: 'REQUEST_IN_FLIGHT',
        message: 'The same request is still being processed',
      });
    }
    return { response: row.response_body };
  }

  async complete(
    m: EntityManager,
    organizationId: string,
    scope: string,
    key: string,
    response: unknown,
  ): Promise<void> {
    await m.query(
      `UPDATE idempotency_keys SET response_status = 200, response_body = $3
        WHERE organization_id = $1 AND key = $2`,
      [organizationId, this.scoped(scope, key), JSON.stringify(response)],
    );
  }

  private scoped(scope: string, key: string): string {
    const k = key.trim();
    if (!k || k.length > 150) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key must be 1–150 characters',
      });
    }
    return `${scope}:${k}`;
  }
}
