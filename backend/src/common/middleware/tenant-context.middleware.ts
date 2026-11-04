import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthorizationService } from 'src/auth/services/authorization.service';

/**
 * Tenant context extracted from request headers.
 */
export interface TenantContext {
  organizationId: string;
  locationId: string;
}

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

/**
 * Routes that don't require tenant context.
 * These are either public routes, auth routes, or global admin routes.
 */
const CONTEXT_FREE_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/select-location',
  '/auth/switch-location',
  '/auth/me',
  '/auth/sessions',
  '/auth/change-password',
  '/auth/add-password',
  '/auth/logout-all',
  '/auth/google',
  '/auth/login-methods',
  '/auth/create-clinic',
  '/locations',
];

/**
 * Middleware that extracts and validates tenant context (organization + location)
 * from request headers on every protected request.
 *
 * The context is injected by the frontend Axios interceptor as:
 * - x-organization-id
 * - x-location-id
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly authorizationService: AuthorizationService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.path.toLowerCase();

    // Skip context validation for auth and public routes
    if (this.isContextFree(path)) {
      return next();
    }

    // If no authenticated user yet (JWT guard hasn't run), skip
    // Tenant validation will be done in the TenantContextGuard after JWT
    const user = (req as any).user;
    if (!user) {
      return next();
    }

    const organizationId = req.headers['x-organization-id'] as string;
    const locationId = req.headers['x-location-id'] as string;

    // If headers are missing, skip middleware (guard will handle enforcement)
    if (!organizationId || !locationId) {
      return next();
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

    // Attach tenant context to request
    req.tenantContext = {
      organizationId,
      locationId,
    };
    next();
  }

  private isContextFree(path: string): boolean {
    return CONTEXT_FREE_PATHS.some((p) => path.startsWith(p));
  }
}
