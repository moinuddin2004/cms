import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { REQUIRE_FEATURE_KEY } from 'src/common/decorators/require-feature.decorator';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { FeatureFlagsService } from '../feature-flags.service';

/**
 * FeatureFlagGuard — runs after JwtAuthGuard and TenantContextGuard.
 *
 * Enforcement logic:
 * 1. No @RequireFeature metadata → allow through. Class- and method-level
 *    @RequireFeature are merged: every listed feature must be enabled.
 * 2. @Public() routes → skip (auth already handled upstream)
 * 3. Super admins → always allow
 * 4. Everyone else → feature must be active for their org and location
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Class- and method-level features are BOTH required (merge, not override).
    const requiredFeatures = requiredFeaturesOf(this.reflector, context);

    // No feature requirement → nothing to enforce
    if (!requiredFeatures.length) return true;

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

    // A location can only switch features off, so an unverified header is safe.
    const rawLocation: unknown =
      request.tenantContext?.locationId || request.headers['x-location-id'];
    const locationId =
      typeof rawLocation === 'string' && isUUID(rawLocation)
        ? rawLocation
        : null;

    const enabled = await this.featureFlagsService.getEnabledFeatures(
      organizationId,
      locationId,
    );
    const missing = requiredFeatures.find((f) => !enabled.has(f));

    if (missing) {
      throw new ForbiddenException(
        `The "${missing}" feature is not enabled for this ${locationId ? 'location' : 'organization'}`,
      );
    }

    return true;
  }
}

/** Every `@RequireFeature` key on the handler and its controller, deduplicated. */
export function requiredFeaturesOf(
  reflector: Reflector,
  context: ExecutionContext,
): string[] {
  const keys: unknown[] =
    reflector.getAllAndMerge<string[]>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
  return [
    ...new Set(
      keys.flat().filter((k): k is string => typeof k === 'string' && !!k),
    ),
  ];
}
