import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AccessContext } from 'src/access/access-context';
import { noPermission } from 'src/access/decorators/access.decorators';
import { legacyRolesFromPermissions } from 'src/access/legacy-roles';
import { Actor, ALL_APP_ROLES } from 'src/common/enums/app-role.enum';

/**
 * A clinic-side lab caller: the legacy `Actor` shape plus the request's
 * AccessContext. Permission checks ask `access.can(...)`; `roles` stays only
 * because workflow transitions still match `allowedRoles` by role name.
 */
export interface ClinicActor extends Actor {
  access: AccessContext;
}

/**
 * Legacy roles are derived from permissions the same way the removed RolesGuard did
 * (`legacyRolesFromPermissions`); owners and super admins get every role.
 */
export function clinicActorOf(access: AccessContext): ClinicActor {
  return {
    userId: access.userId,
    employeeId: access.employeeId,
    roles:
      access.isOwner || access.isSuperAdmin
        ? [...ALL_APP_ROLES]
        : legacyRolesFromPermissions(access.permissions),
    access,
  };
}

/**
 * The caller as a `ClinicActor`, built from the AccessContext AccessGuard
 * put on the request. Use on `@Can` / `@AnyMember` routes (replaces
 * `@CurrentActor()`, which needs `@Roles`).
 */
export const CurrentClinicActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClinicActor => {
    const access = ctx
      .switchToHttp()
      .getRequest<{ access?: AccessContext }>().access;
    if (!access) throw noPermission([], 'No organization selected');
    return clinicActorOf(access);
  },
);
