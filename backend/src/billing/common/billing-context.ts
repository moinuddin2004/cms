import type { AccessContext } from 'src/access/access-context';
import type { Permission } from 'src/access/catalog/permissions';
import { noPermission } from 'src/access/decorators/access.decorators';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

/** The part of AccessContext billing rules ask (`can` / `decide`). */
export type BillingAccess = Pick<AccessContext, 'can' | 'decide'>;

/** Who performs a billing write, reduced to what billing rules need (10.3). */
export interface BillingActor {
  readonly userId: string;
  readonly employeeId: string | null;
  /** Permission checks (price override, custom discount, void …). */
  readonly access: BillingAccess;
  /** Stored on audit rows. */
  readonly role: string;
}

/** Tenant + actor for one request; every service method receives it. */
export interface BillingContext {
  readonly tenant: TenantContext;
  readonly actor: BillingActor;
}

export const SYSTEM_BILLING_ROLE = 'system';

/** System writes (charges from a completed visit) hold no permission. */
export const NO_BILLING_ACCESS: BillingAccess = {
  can: () => false,
  decide: () => 'deny',
};

/** Audit label: owner / super admin, else the role (template key or name). */
function auditRole(access: AccessContext): string {
  if (access.isOwner) return 'owner';
  if (access.isSuperAdmin) return 'super_admin';
  return access.roles.map((r) => r.templateKey ?? r.name).join(',') || 'member';
}

export function toBillingActor(access: AccessContext): BillingActor {
  return {
    userId: access.userId,
    employeeId: access.employeeId,
    access,
    role: auditRole(access),
  };
}

export function billingContext(
  tenant: TenantContext,
  access: AccessContext,
): BillingContext {
  return { tenant, actor: toBillingActor(access) };
}

/** 403 NO_PERMISSION (same body as AccessGuard) unless the actor holds `perm`. */
export function assertBillingCan(actor: BillingActor, perm: Permission): void {
  if (!actor.access.can(perm)) throw noPermission([perm]);
}
