import * as crypto from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { ValidationFailedException } from 'src/common/exceptions/ValidationFailedException';
import { MailService } from 'src/common/services/mail.service';

const TOKEN_DAYS = 7;
const hash = (raw: string) =>
  crypto.createHash('sha256').update(raw).digest('hex');

/**
 * A lab's contact address must be confirmed before any email (order links
 * included) goes to it (notifications + email plan, P3). The super admin who
 * sets the address triggers a confirmation link to it, and may also mark it
 * verified directly. Changing the address clears the confirmation.
 */
@Injectable()
export class LabEmailVerificationService {
  private readonly logger = new Logger(LabEmailVerificationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly mail: MailService,
  ) {}

  /** Clears any confirmation and emails a fresh link; resolves to whether it went out. */
  async start(labId: string): Promise<boolean> {
    const raw = crypto.randomBytes(32).toString('hex');
    const [lab] = await sqlRows<{ name: string; email: string | null }>(
      this.dataSource,
      `UPDATE labs
          SET email_verified_at = NULL,
              email_verify_token = $2,
              email_verify_expires = now() + make_interval(days => $3)
        WHERE id = $1
        RETURNING name, email`,
      [labId, hash(raw), TOKEN_DAYS],
    );
    if (!lab) throw new NotFoundException('Lab not found');
    if (!lab.email) return false;
    return this.mail.sendLabEmailConfirmation(lab.email, lab.name, raw);
  }

  /** From the emailed link (public). */
  async confirm(token: string): Promise<{ labName: string; email: string }> {
    const [lab] = await sqlRows<{ name: string; email: string }>(
      this.dataSource,
      `UPDATE labs
          SET email_verified_at = now(),
              email_verify_token = NULL,
              email_verify_expires = NULL
        WHERE email_verify_token = $1
          AND email_verify_expires > now()
          AND email IS NOT NULL
        RETURNING name, email`,
      [hash(token)],
    );
    if (!lab) {
      throw new ValidationFailedException(
        'This confirmation link is invalid or has expired',
      );
    }
    this.logger.log(`Lab email ${lab.email} confirmed`);
    return { labName: lab.name, email: lab.email };
  }

  /** Super admin: the address is known to be right. */
  async markVerified(labId: string, adminId: string | null): Promise<void> {
    const [lab] = await sqlRows<{ id: string }>(
      this.dataSource,
      `UPDATE labs
          SET email_verified_at = COALESCE(email_verified_at, now()),
              email_verify_token = NULL,
              email_verify_expires = NULL
        WHERE id = $1 AND email IS NOT NULL
        RETURNING id`,
      [labId],
    );
    if (!lab) {
      throw new ValidationFailedException('This lab has no email address');
    }
    this.logger.log(`Lab ${labId} email marked verified by ${adminId}`);
  }
}
