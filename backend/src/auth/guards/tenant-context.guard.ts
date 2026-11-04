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
import { ClinicGateService } from 'src/clinic-access/clinic-gate.service';

/**
 * TenantContextGuard — replaces the old RoleAuthGuard.
 *
 * Enforcement logic (order matters):
 * 1. Public routes: skip entirely (@Public)
 * 2. Super-admin-only routes: validate super admin role (@RequireSuperAdmin).
 *    Checked before @ContextFree so nothing can skip it.
 * 3. Context-free routes: skip tenant validation (@ContextFree — auth routes,
 *    location management, which checks ownership in its controller)
 * 4. All other routes: validate tenant context (org + location must be present and accessible),
 *    then ClinicGate: the clinic is approved and the session's sign-in
 *    method fits its sign-in policy
 *
 * There is deliberately no path-prefix allow-list: a prefix like '/organizations'
 * used to short-circuit the guard before step 2 ran.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizationService: AuthorizationService,
    private gate: ClinicGateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    const targets = [context.getHandler(), context.getClass()];

    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    if (isPublic) return true;

    // Check @RequireSuperAdmin() decorator
    const requiresSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUPER_ADMIN_KEY,
      targets,
    );
    if (requiresSuperAdmin) {
      const user = request.user;
      if (!user) return false;
      if (!(await this.authorizationService.isSuperAdmin(user.uuid))) {
        throw new ForbiddenException('Super admin access required');
      }
      return true;
    }

    // Check @ContextFree() decorator — auth/switching routes
    const isContextFree = this.reflector.getAllAndOverride<boolean>(
      CONTEXT_FREE_KEY,
      targets,
    );
    if (isContextFree) return true;

    const user = request.user;
    if (!user) return false;

    // Super admins are exempt from strict tenant context requirements
    if (await this.authorizationService.isSuperAdmin(user.uuid)) {
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

    // The clinic must be approved, and this session's sign-in method must
    // fit the clinic's sign-in policy (403 with a code the web app reads).
    await this.gate.assertUsable(organizationId, {
      method: user.authMethod ?? 'password',
      domain: user.authDomain ?? null,
    });

    // Attach context to request for downstream use
    request.tenantContext = { organizationId, locationId };

    return true;
  }
}
