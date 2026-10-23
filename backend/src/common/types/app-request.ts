import type { Request } from 'express';
import type { Actor } from '../enums/app-role.enum';

/** What JwtStrategy.validate() puts on `request.user`. */
export interface AuthUser {
  uuid: string;
  email?: string;
  globalRole?: string | null;
  sessionId?: string;
}

/**
 * An authenticated API request: `user` from the JWT guard, `tenantContext`
 * from TenantContextGuard (declared on Express.Request globally); `actor`
 * is legacy and no longer set by a guard (AccessGuard sets `access`).
 */
export type AppRequest = Request & {
  user?: AuthUser;
  actor?: Actor;
};
