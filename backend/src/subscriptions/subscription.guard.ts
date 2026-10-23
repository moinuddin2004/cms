import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import type { AppRequest } from 'src/common/types/app-request';
import type { AccessContext } from 'src/access/access-context';
import { SubscriptionsService } from './subscriptions.service';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Writes that stay open on an expired clinic: signing in/out, its own account. */
const ALWAYS_WRITABLE = ['/auth/', '/account', '/me/', '/admin/subscriptions'];

/**
 * Last APP_GUARD: an expired subscription makes the clinic read-only — every
 * write is refused with 402 `SUBSCRIPTION_EXPIRED` until a payment is
 * recorded. Reads always pass, as do super admins and unmanaged clinics.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context
      .switchToHttp()
      .getRequest<AppRequest & { access?: AccessContext }>();
    if (READ_METHODS.has(req.method)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (req.user?.globalRole === GlobalRole.SUPER_ADMIN) return true;
    if (req.access?.isSuperAdmin) return true;
    const path = req.path ?? req.url;
    if (ALWAYS_WRITABLE.some((p) => path.startsWith(p))) return true;

    const header = req.headers['x-organization-id'];
    const orgId =
      req.access?.organizationId ??
      (Array.isArray(header) ? header[0] : header);
    if (!orgId) return true;

    if (await this.subscriptions.isReadOnly(orgId)) {
      throw new HttpException(
        {
          message:
            'Your subscription has expired — the clinic is read-only until it is renewed.',
          code: 'SUBSCRIPTION_EXPIRED',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
