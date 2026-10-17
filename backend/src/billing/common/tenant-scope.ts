import {
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { notFound } from './billing-errors';

interface TenantScoped extends ObjectLiteral {
  id: string;
  organizationId: string;
}

/** Org + location filter for `find` options. */
export function tenantWhere(tenant: TenantContext) {
  return {
    organizationId: tenant.organizationId,
    locationId: tenant.locationId,
  };
}

/**
 * Loads one row of the active tenant or throws BILLING_NOT_FOUND (404) —
 * never 403, so ids of other clinics cannot be probed (10.1). Location is
 * checked only for location-scoped entities (`orgOnly: false`).
 */
export async function findOneInTenantOrFail<T extends TenantScoped>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  id: string,
  tenant: TenantContext,
  opts: { label: string; orgOnly?: boolean; lock?: boolean },
): Promise<T> {
  const where = {
    id,
    organizationId: tenant.organizationId,
    ...(opts.orgOnly ? {} : { locationId: tenant.locationId }),
  } as unknown as FindOptionsWhere<T>;
  const row = await manager.getRepository(entity).findOne({
    where,
    ...(opts.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
  });
  if (!row) throw notFound(opts.label);
  return row;
}

/** Adds `alias.organization_id = :org AND alias.location_id = :loc`. */
export function scopeQuery<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  tenant: TenantContext,
): SelectQueryBuilder<T> {
  return qb
    .andWhere(`${alias}.organization_id = :scopeOrg`, {
      scopeOrg: tenant.organizationId,
    })
    .andWhere(`${alias}.location_id = :scopeLoc`, {
      scopeLoc: tenant.locationId,
    });
}
