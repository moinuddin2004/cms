import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { EmailVerificationService } from 'src/user/email-verification.service';

/** Paths an unverified account may still call: sign-in, session, verify / resend. */
const OPEN_PREFIXES = ['/auth/'];

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/**
 * Global, right after `JwtAuthGuard`: a password account whose email is not
 * verified may use the system only until `users.email_verification_due_at`
 * (now for new accounts, +7 days for accounts from before enforcement);
 * after that every request except `/auth/*` gets 403 `EMAIL_NOT_VERIFIED`
 * and the web app shows the verify screen. Exempt: unauthenticated (public)
 * requests, super admins, and Google sessions (Google proved the address).
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly verification: EmailVerificationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<
      Request & {
        user?: {
          uuid?: string;
          globalRole?: string | null;
          authMethod?: string;
        };
      }
    >();
    const user = req.user;
    if (!user?.uuid) return true;
    if (user.globalRole === GlobalRole.SUPER_ADMIN) return true;
    if (user.authMethod === 'google') return true;
    const path = (req.originalUrl ?? req.url).split('?')[0].toLowerCase();
    if (OPEN_PREFIXES.some((p) => path.startsWith(p))) return true;

    const gate = await this.verification.gate(user.uuid);
    if (gate.state !== 'blocked') return true;
    throw new ForbiddenException({
      code: EMAIL_NOT_VERIFIED,
      message:
        'Please verify your email address to continue. Check your inbox for the link, or send a new one.',
    });
  }
}
