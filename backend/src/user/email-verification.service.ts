import * as crypto from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityLog } from 'src/auth/entities/SecurityLog';
import { SecurityEventType } from 'src/auth/enum/SecurityEventType';
import { sqlRows } from 'src/common/database/sql';
import { ValidationFailedException } from 'src/common/exceptions/ValidationFailedException';
import { MailService } from 'src/common/services/mail.service';
import { User } from './entities/user.entity';

/** How long a verification link works. */
export const EMAIL_VERIFICATION_TOKEN_HOURS = 48;
/** Grace for accounts that existed before verification was enforced. */
export const EMAIL_VERIFICATION_GRACE_DAYS = 7;
const CACHE_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Where an account stands for `EmailVerifiedGuard`. */
export type VerificationGate =
  | { state: 'verified' }
  | { state: 'grace'; dueAt: Date }
  | { state: 'blocked' };

const hash = (raw: string) =>
  crypto.createHash('sha256').update(raw).digest('hex');

/**
 * The one place that owns `users.email_verified_at` (docs/notifications-
 * email-plan.md, Phase 2): starting a verification (token + email + due
 * date), confirming it from the link, resending, a super admin marking an
 * address verified, and the per-request gate. A failed send never fails the
 * caller — it is logged; resend and the super admin are the way out.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly cache = new Map<
    string,
    { value: VerificationGate; at: number }
  >();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(SecurityLog)
    private readonly securityLogs: Repository<SecurityLog>,
    private readonly mail: MailService,
  ) {}

  /**
   * New token + email. `dueAt` = until when the account may work unverified
   * (now, for a brand-new account). Mutates `user` so a login payload built
   * from it is current.
   */
  async start(user: User, dueAt: Date): Promise<void> {
    const raw = crypto.randomBytes(32).toString('hex');
    const patch = {
      emailVerificationToken: hash(raw),
      emailVerificationExpires: tokenExpiry(),
      emailVerificationDueAt: dueAt,
    };
    await this.users.update(user.uuid, patch);
    Object.assign(user, patch);
    this.invalidate(user.uuid);
    await this.send(user.uuid, user.email, raw);
  }

  /**
   * An unverified password account with no due date yet (it existed before
   * enforcement): give it the grace period and send the link — once, even
   * with concurrent requests. Mutates `user`.
   */
  async ensureScheduled(user: User): Promise<void> {
    if (user.emailVerifiedAt || user.emailVerificationDueAt || !user.password)
      return;
    const dueAt = await this.claimGrace(user.uuid);
    if (dueAt) {
      user.emailVerificationDueAt = dueAt;
      user.emailVerificationToken = (
        await this.issueAndSend(user.uuid, user.email)
      ).tokenHash;
    }
  }

  /** Confirm from the emailed link. */
  async confirm(token: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('user')
      .where('user.emailVerificationToken = :tokenHash', {
        tokenHash: hash(token),
      })
      .andWhere('user.emailVerificationExpires > :now', { now: new Date() })
      .getOne();
    if (!user) {
      throw new ValidationFailedException(
        'This verification link is invalid or has expired',
      );
    }
    await this.setVerified(user.uuid);
    await this.securityLog(user.uuid, SecurityEventType.EMAIL_VERIFIED, {
      via: 'link',
    });
    return user;
  }

  /** Fresh link for an unverified account. */
  async resend(
    userId: string,
  ): Promise<'sent' | 'failed' | 'already_verified'> {
    const user = await this.users.findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerifiedAt) return 'already_verified';
    if (!user.emailVerificationDueAt) await this.claimGrace(user.uuid);
    const { sent } = await this.issueAndSend(user.uuid, user.email);
    return sent ? 'sent' : 'failed';
  }

  /** Super admin: mark an address verified without the link. */
  async markVerifiedByAdmin(userId: string, adminId: string): Promise<User> {
    const user = await this.users.findOneBy({ uuid: userId });
    if (!user) throw new NotFoundException('User not found');
    if (!user.emailVerifiedAt) {
      await this.setVerified(user.uuid);
      await this.securityLog(
        user.uuid,
        SecurityEventType.EMAIL_VERIFIED_BY_ADMIN,
        { verifiedBy: adminId, email: user.email },
      );
      this.logger.log(`Email of ${user.uuid} marked verified by ${adminId}`);
    }
    return (await this.users.findOneBy({ uuid: userId })) ?? user;
  }

  /** A completed password reset proves the mailbox. */
  async verifiedByPasswordReset(userId: string): Promise<void> {
    const rows = await sqlRows<{ uuid: string }>(
      this.users.manager,
      `UPDATE users
          SET email_verified_at = now(),
              email_verification_token = NULL,
              email_verification_expires = NULL,
              email_verification_due_at = NULL
        WHERE uuid = $1 AND email_verified_at IS NULL
        RETURNING uuid`,
      [userId],
    );
    this.invalidate(userId);
    if (rows.length) {
      await this.securityLog(userId, SecurityEventType.EMAIL_VERIFIED, {
        via: 'password_reset',
      });
    }
  }

  /** The address changed: unverified again, the new one must be verified first; the old one is told. */
  async emailChanged(user: User, previousEmail: string): Promise<void> {
    await this.users.update(user.uuid, { emailVerifiedAt: null });
    user.emailVerifiedAt = null;
    await this.start(user, new Date());
    void this.mail.sendSecurityNotice(
      'email_changed',
      previousEmail,
      'The email address of your account was changed',
      `Your account now uses ${user.email}. Emails will no longer come to this address.`,
      user.uuid,
    );
  }

  /** Per-request gate (cached briefly per instance). Schedules legacy accounts lazily. */
  async gate(userId: string): Promise<VerificationGate> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_MS) return gateNow(hit.value);

    const [row] = await sqlRows<{
      email: string;
      verified: boolean;
      due_at: Date | null;
      has_password: boolean;
    }>(
      this.users.manager,
      `SELECT email,
              email_verified_at IS NOT NULL AS verified,
              email_verification_due_at AS due_at,
              password IS NOT NULL AS has_password
         FROM users WHERE uuid = $1`,
      [userId],
    );
    let value: VerificationGate;
    if (!row || row.verified || !row.has_password) {
      // No password = signs in with Google only, which verifies on sign-in.
      value = { state: 'verified' };
    } else if (!row.due_at) {
      const dueAt = await this.claimGrace(userId);
      if (dueAt) await this.issueAndSend(userId, row.email);
      value = gateFor(dueAt ?? new Date(Date.now() + DAY_MS));
    } else {
      value = gateFor(new Date(row.due_at));
    }
    this.cache.set(userId, { value, at: Date.now() });
    return value;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  private async setVerified(userId: string): Promise<void> {
    await this.users.update(userId, {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpires: null,
      emailVerificationDueAt: null,
    });
    this.invalidate(userId);
  }

  /** Sets the grace due date if none is set yet; null when another request already did. */
  private async claimGrace(userId: string): Promise<Date | null> {
    const [row] = await sqlRows<{ due_at: Date }>(
      this.users.manager,
      `UPDATE users
          SET email_verification_due_at = now() + make_interval(days => $2)
        WHERE uuid = $1
          AND email_verified_at IS NULL
          AND email_verification_due_at IS NULL
        RETURNING email_verification_due_at AS due_at`,
      [userId, EMAIL_VERIFICATION_GRACE_DAYS],
    );
    this.invalidate(userId);
    return row ? new Date(row.due_at) : null;
  }

  /** New token (the due date stays) and the email. */
  private async issueAndSend(
    userId: string,
    email: string,
  ): Promise<{ tokenHash: string; sent: boolean }> {
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = hash(raw);
    await this.users.update(userId, {
      emailVerificationToken: tokenHash,
      emailVerificationExpires: tokenExpiry(),
    });
    const sent = await this.send(userId, email, raw);
    return { tokenHash, sent };
  }

  /** Never throws; a failure is in `email_log`. */
  private async send(userId: string, email: string, raw: string) {
    const sent = await this.mail.sendEmailVerification(email, raw, userId);
    if (sent) {
      await this.securityLog(userId, SecurityEventType.EMAIL_VERIFICATION_SENT);
    }
    return sent;
  }

  private async securityLog(
    userId: string,
    eventType: SecurityEventType,
    metadata: Record<string, unknown> = {},
  ) {
    await this.securityLogs.save(
      this.securityLogs.create({ userId, eventType, metadata }),
    );
  }
}

const tokenExpiry = () =>
  new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000);

/** Pure: grace until `dueAt`, blocked from then on. Exported for the spec. */
export function gateFor(dueAt: Date, now = new Date()): VerificationGate {
  return dueAt.getTime() > now.getTime()
    ? { state: 'grace', dueAt }
    : { state: 'blocked' };
}

/** A cached grace entry may run out while cached. */
function gateNow(v: VerificationGate): VerificationGate {
  return v.state === 'grace' ? gateFor(v.dueAt) : v;
}
