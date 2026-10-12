import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Actor, AppRole } from '../enums/app-role.enum';
import type { AppRequest } from '../types/app-request';

export const REQUIRED_ROLES_KEY = 'requiredAppRoles';

/**
 * Restrict a route (or controller) to users holding at least one of these
 * clinic roles at the active location. Enforced by the global `RolesGuard`.
 * Routes without `@Roles()` are open to any member of the location.
 */
export const Roles = (...roles: AppRole[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);

/**
 * The resolved `Actor` (user id, roles, employee id) for this request.
 * Populated by `RolesGuard` on routes that declare `@Roles()`.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const actor = ctx.switchToHttp().getRequest<AppRequest>().actor;
    if (!actor) {
      // Programming error: the route forgot @Roles(), so RolesGuard never ran.
      throw new Error('@CurrentActor() needs @Roles() on the route');
    }
    return actor;
  },
);
