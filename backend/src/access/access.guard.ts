import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import type { AppRequest } from 'src/common/types/app-request';
import { AccessResolver, isUuid } from './access.resolver';
import type { AccessContext } from './access-context';
import type { Permission } from './catalog/permissions';
import {
  ANY_MEMBER_KEY,
  CAN_KEY,
  noPermission,
} from './decorators/access.decorators';

type AccessRequest = AppRequest & { access?: AccessContext };

function header(req: AccessRequest, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Every `@Can` permission on the handler and its controller, deduplicated. */
export function requiredPermissionsOf(
  reflector: Reflector,
  context: ExecutionContext,
): Permission[] {
  const perms = reflector.getAllAndMerge<Permission[]>(CAN_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  return [...new Set((perms ?? []).flat())];
}

/**
 * AccessGuard — runs last (after JwtAuthGuard → TenantContextGuard →
 * FeatureFlagGuard → RolesGuard).
 *
 * - `@Public()` → skip.
 * - `@Can(...)` → every permission (class + method, merged) must be held,
 *   else 403 `{ code: 'NO_PERMISSION', missing: [...] }`.
 * - `@AnyMember()` → must be an active member of the location.
 * - Neither → passes for now (wave 3 makes a missing decorator a boot error).
 *
 * Whenever the request names an organization the resolved AccessContext is
 * put on `request.access` (for `@Access()` and `@VisibleIf`).
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: AccessResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const required = requiredPermissionsOf(this.reflector, context);
    const anyMember = !!this.reflector.getAllAndOverride<boolean>(
      ANY_MEMBER_KEY,
      targets,
    );

    const req = context.switchToHttp().getRequest<AccessRequest>();
    const userId = req.user?.uuid;
    const organizationId =
      req.tenantContext?.organizationId ?? header(req, 'x-organization-id');
    const rawLocation =
      req.tenantContext?.locationId ?? header(req, 'x-location-id');
    const locationId = isUuid(rawLocation) ? rawLocation : null;
    const hasTenant = !!userId && isUuid(organizationId);

    if (!required.length && !anyMember) {
      if (hasTenant) {
        req.access = await this.resolver
          .resolve(userId, organizationId, locationId)
          .catch(() => undefined);
      }
      return true;
    }

    if (!hasTenant) throw noPermission(required, 'No organization selected');

    const access = await this.resolver.resolve(
      userId,
      organizationId,
      locationId,
    );
    req.access = access;

    if (anyMember && !access.isMember) throw noPermission([]);
    const missing = required.filter((p) => !access.can(p));
    if (missing.length) throw noPermission(missing);
    return true;
  }
}
