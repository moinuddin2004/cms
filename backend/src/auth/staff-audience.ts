import { UnauthorizedException } from '@nestjs/common';

/** `aud` of a staff-space access token (web app and mobile staff space). */
export const STAFF_AUDIENCE = 'staff';

/**
 * Reject an access-token payload that belongs to another space.
 *
 * Staff tokens carry `aud: 'staff'` (minted in `jwt.service.ts`). Tokens
 * minted before the audience was introduced have no `aud` at all and stay
 * valid during the transition; the patient space already signs with a
 * different secret and `aud: 'patient'`, so anything else is not a staff
 * token.
 *
 * TODO(M4-06): require `aud` on staff tokens — drop the no-aud case.
 */
export function assertStaffAudience(payload: { aud?: unknown }): void {
  if (payload.aud === undefined || payload.aud === null) return;
  if (payload.aud === STAFF_AUDIENCE) return;
  throw new UnauthorizedException('Invalid token audience');
}
