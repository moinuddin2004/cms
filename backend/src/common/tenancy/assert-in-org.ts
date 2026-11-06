import { NotFoundException } from '@nestjs/common';
import {
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  In,
  ObjectLiteral,
} from 'typeorm';

/**
 * Tenant check for ids that arrive in a request BODY (patientId, doctorId,
 * supplierId, …). Guards only prove the caller belongs to the active org;
 * they say nothing about ids inside the payload. Every such id must be
 * checked against the active org before it is saved or used, otherwise a
 * user of clinic A can link — and then read back — clinic B's rows.
 *
 * Each check is skipped when its id is null/undefined (optional field).
 * Fails with 404 "<label> not found" — never reveals that the row exists
 * in another clinic.
 */
export interface InOrgCheck<T = any> {
  entity: EntityTarget<T>;
  /** The id from the request; nothing is checked when empty. */
  id: string | null | undefined;
  /** Conditions the row must meet, e.g. `{ organizationId }` (+ parent ids). */
  where: FindOptionsWhere<T>;
  /** Column holding `id` (default `id`). */
  idColumn?: string;
  label: string;
}

export async function assertInOrg(
  em: EntityManager,
  checks: InOrgCheck[],
): Promise<void> {
  for (const c of checks) {
    if (!c.id) continue;
    const ok = await em
      .getRepository(c.entity)
      .existsBy({ ...c.where, [c.idColumn ?? 'id']: c.id } as never);
    if (!ok) throw new NotFoundException(`${c.label} not found`);
  }
}

/** Every id in `ids` must match `where` (e.g. inventory items of this org). */
export async function assertAllInOrg<T extends ObjectLiteral>(
  em: EntityManager,
  entity: EntityTarget<T>,
  ids: (string | null | undefined)[],
  where: FindOptionsWhere<T>,
  label: string,
): Promise<void> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return;
  const found = await em
    .getRepository(entity)
    .countBy({ ...where, id: In(unique) } as never);
  if (found !== unique.length) throw new NotFoundException(`${label} not found`);
}
