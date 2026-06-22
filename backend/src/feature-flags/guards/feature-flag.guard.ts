import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { REQUIRE_FEATURE_KEY } from 'src/common/decorators/require-feature.decorator';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { FeatureFlagsService } from '../feature-flags.service';

/**
 * FeatureFlagGuard — runs after JwtAuthGuard and TenantContextGuard.
 *
 * Enforcement logic:
 * 1. No @RequireFeature metadata → allow through
 * 2. @Public() routes → skip (auth already handled upstream)
 * 3. Super admins → always allow
 * 4. Everyone else → feature must be enabled for their active org
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No feature requirement → nothing to enforce
    if (!requiredFeature) return true;

    // Public routes skip feature enforcement
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<any>();
    const user = request.user;
    if (!user) return false;

    // Super admins bypass feature gating
    if (await this.authorizationService.isSuperAdmin(user.uuid)) {
      return true;
    }

    // Resolve the active organization from tenant context or headers
    const organizationId =
      request.tenantContext?.organizationId ||
      request.headers['x-organization-id'];

    if (!organizationId) {
      throw new ForbiddenException(
        'No active organization context for feature check',
      );
    }

    const enabled = await this.featureFlagsService.isFeatureEnabled(
      organizationId,
      requiredFeature,
    );

    if (!enabled) {
      throw new ForbiddenException(
        `The "${requiredFeature}" feature is not enabled for this organization`,
      );
    }

    return true;
  }
}
