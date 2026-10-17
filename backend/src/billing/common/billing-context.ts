import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

/** Who performs a billing write, reduced to what billing rules need (10.3). */
export interface BillingActor {
  readonly userId: string;
  readonly employeeId: string | null;
  /** Any admin role grants admin rights (V6). */
  readonly isAdmin: boolean;
  /** Stored on audit rows. */
  readonly role: string;
}

/** Tenant + actor for one request; every service method receives it. */
export interface BillingContext {
  readonly tenant: TenantContext;
  readonly actor: BillingActor;
}

export const SYSTEM_BILLING_ROLE = 'system';

export function toBillingActor(actor: Actor): BillingActor {
  const isAdmin = actor.roles.includes(AppRole.CLINIC_ADMIN);
  return {
    userId: actor.userId,
    employeeId: actor.employeeId,
    isAdmin,
    role: isAdmin
      ? AppRole.CLINIC_ADMIN
      : actor.roles.includes(AppRole.RECEPTIONIST)
        ? AppRole.RECEPTIONIST
        : actor.roles.join(',') || 'member',
  };
}

export function billingContext(
  tenant: TenantContext,
  actor: Actor,
): BillingContext {
  return { tenant, actor: toBillingActor(actor) };
}
