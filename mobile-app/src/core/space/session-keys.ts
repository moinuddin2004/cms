import type { Space } from './useSpaceStore';

/**
 * SecureStore keys of each space's refresh token (docs/03 §2.1). Kept in core
 * so the space-switch logic can ask "does the other space have a saved
 * session?" without importing it. The staff key is unchanged from before the
 * core/staff split, so existing sessions keep working.
 */
export const REFRESH_TOKEN_KEYS: Record<Space, string> = {
  staff: 'auth.refreshToken',
  patient: 'patient.refreshToken',
};
