import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import type { Permission } from '../catalog/permissions';
import type { AccessContext } from '../access-context';

export const CAN_KEY = 'access:can';
export const ANY_MEMBER_KEY = 'access:anyMember';

/**
 * Require ALL of these permissions at the active org + location. Class- and
 * method-level `@Can` are merged (both apply). Enforced by AccessGuard.
 */
export const Can = (...permissions: Permission[]) =>
  SetMetadata(CAN_KEY, permissions);

/** Open to any active member of the location (owners and super admins too). */
export const AnyMember = () => SetMetadata(ANY_MEMBER_KEY, true);

/** The 403 body for a refused request (`missing` = permissions not held). */
export function noPermission(missing: string[], message?: string) {
  return new ForbiddenException({
    code: 'NO_PERMISSION',
    missing,
    message:
      message ??
      (missing.length
        ? `Missing permission: ${missing.join(', ')}`
        : 'You are not a member of this location'),
  });
}

/**
 * The request's AccessContext (set by AccessGuard whenever the request has
 * an organization). Throws 403 NO_PERMISSION when there is none.
 */
export const Access = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessContext => {
    const access = ctx
      .switchToHttp()
      .getRequest<{ access?: AccessContext }>().access;
    if (!access) throw noPermission([], 'No organization selected');
    return access;
  },
);
