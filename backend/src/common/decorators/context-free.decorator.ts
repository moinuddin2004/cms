import { SetMetadata } from '@nestjs/common';

export const CONTEXT_FREE_KEY = 'contextFree';

/**
 * Decorator to mark an endpoint as not requiring tenant context.
 * Used for auth routes (login, register, select-location) and
 * endpoints that don't need org/location scope.
 */
export const ContextFree = () => SetMetadata(CONTEXT_FREE_KEY, true);
