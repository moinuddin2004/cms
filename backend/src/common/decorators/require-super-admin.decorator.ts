import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SUPER_ADMIN_KEY = 'requireSuperAdmin';

/**
 * Decorator to mark an endpoint as requiring super admin access.
 * These endpoints skip tenant context validation — they operate globally.
 */
export const RequireSuperAdmin = () =>
  SetMetadata(REQUIRE_SUPER_ADMIN_KEY, true);
