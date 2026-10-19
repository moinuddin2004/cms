import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';

export interface SequenceSpec {
  /** Counter name, unique per organization, e.g. `lab_order`. */
  key: string;
  /** Printed prefix, e.g. `LAB` → `LAB-0001`. Fixed by the first call. */
  prefix: string;
  /** Minimum digits (zero-padded). Longer numbers are never truncated. */
  pad?: number;
}

/**
 * Gapless, duplicate-free per-organization numbers (lab ERD §8). The upsert
 * row-locks the counter until the surrounding transaction ends, so
 * concurrent callers serialise, and a rollback gives the number back.
 */
@Injectable()
export class NumberSequenceService {
  async next(
    manager: EntityManager,
    organizationId: string,
    spec: SequenceSpec,
  ): Promise<string> {
    if (!manager.queryRunner?.isTransactionActive) {
      // Outside a transaction the number would be burnt even if the caller fails.
      throw new Error(
        'NumberSequenceService.next() must run inside a transaction',
      );
    }
    const [row] = await sqlRows<{ value: string; prefix: string }>(
      manager,
      `INSERT INTO number_sequences (organization_id, sequence_key, prefix, next_value)
       VALUES ($1, $2, $3, 2)
       ON CONFLICT (organization_id, sequence_key)
       DO UPDATE SET next_value = number_sequences.next_value + 1, updated_at = now()
       RETURNING next_value - 1 AS value, prefix`,
      [organizationId, spec.key, spec.prefix],
    );
    return `${row.prefix}-${String(row.value).padStart(spec.pad ?? 4, '0')}`;
  }
}
