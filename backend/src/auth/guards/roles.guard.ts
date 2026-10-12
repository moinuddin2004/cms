import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../services/authorization.service';
import { REQUIRED_ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { AppRole } from 'src/common/enums/app-role.enum';
import type { AppRequest } from 'src/common/types/app-request';

/** First value of a possibly repeated header. */
function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * RolesGuard — runs after JwtAuthGuard → TenantContextGuard → FeatureFlagGuard.
 *
 * Routes without `@Roles()` pass through. Otherwise the user's roles at the
 * active organization + location are resolved, attached as `request.actor`,
 * and at least one required role must match (403 FORBIDDEN otherwise).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AppRole[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    const user = request.user;
    const organizationId =
      request.tenantContext?.organizationId ??
      headerValue(request.headers['x-organization-id']);
    const locationId =
      request.tenantContext?.locationId ??
      headerValue(request.headers['x-location-id']);

    if (!user?.uuid || !organizationId || !locationId) {
      throw new ForbiddenException({
        message: 'Missing user or tenant context',
        code: 'FORBIDDEN',
      });
    }

    const actor = await this.authorizationService.resolveActor(
      user.uuid,
      organizationId,
      locationId,
    );

    if (!actor.roles.some((r) => required.includes(r))) {
      throw new ForbiddenException({
        message: `This action needs one of these roles: ${required.join(', ')}`,
        code: 'FORBIDDEN',
      });
    }

    request.actor = actor;
    return true;
  }
}
