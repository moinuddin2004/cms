import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Decorator to gate an endpoint behind an enabled feature flag.
 * The FeatureFlagGuard reads this metadata and checks the active org.
 *
 * Usage:
 *   @RequireFeature('billing.invoices')
 *   @Post('invoices')
 *   async create() { ... }
 */
export const RequireFeature = (key: string) =>
  SetMetadata(REQUIRE_FEATURE_KEY, key);
