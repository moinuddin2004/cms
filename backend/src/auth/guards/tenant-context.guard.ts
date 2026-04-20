import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../services/authorization.service';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { REQUIRE_SUPER_ADMIN_KEY } from 'src/common/decorators/require-super-admin.decorator';
import { CONTEXT_FREE_KEY } from 'src/common/decorators/context-free.decorator';

/**
 * Routes that don't require tenant context headers.
 * Overlaps with the middleware list but used for guard enforcement.
 */
const CONTEXT_FREE_PATHS = [
  '/auth/',
  '/organizations', // Org listing (super admin)
  '/locations', // Locations management (handled in controller)
];

/**
 * TenantContextGuard — replaces the old RoleAuthGuard.
 *
 * Enforcement logic:
 * 1. Public routes: skip entirely (handled by @Public decorator)
 * 2. Context-free routes: skip tenant validation (auth routes, etc.)
 * 3. Super-admin-only routes: validate super admin role only
 * 4. All other routes: validate tenant context (org + location must be present and accessible)
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    const path = request.url?.split('?')[0]?.toLowerCase() || '';

    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Check @ContextFree() decorator — auth/switching routes
    const isContextFree = this.reflector.getAllAndOverride<boolean>(
      CONTEXT_FREE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isContextFree) return true;

    // Check path-based context-free
    if (this.isContextFreePath(path)) return true;

    const user = request.user;
    if (!user) return false;

    // Check @RequireSuperAdmin() decorator
    const requiresSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUPER_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isSA = await this.authorizationService.isSuperAdmin(user.uuid);
    if (requiresSuperAdmin) {
      if (!isSA) {
        throw new ForbiddenException('Super admin access required');
      }
      return true;
    }

    // Super admins are exempt from strict tenant context requirements
    if (isSA) {
      return true;
    }

    // For all other routes, tenant context must be present
    const organizationId =
      request.headers['x-organization-id'] ||
      request.tenantContext?.organizationId;
    const locationId =
      request.headers['x-location-id'] || request.tenantContext?.locationId;

    if (!organizationId || !locationId) {
      throw new BadRequestException(
        'Missing tenant context. Please select an organization and location.',
      );
    }

    // Validate access
    const hasAccess = await this.authorizationService.validateAccess(
      user.uuid,
      organizationId,
      locationId,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this organization/location',
      );
    }

    // Attach context to request for downstream use
    request.tenantContext = { organizationId, locationId };

    return true;
  }

  private isContextFreePath(path: string): boolean {
    return CONTEXT_FREE_PATHS.some((p) => path.startsWith(p));
  }
}
