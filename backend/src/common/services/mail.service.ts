import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appUrl, renderEmail } from '../mail/email-layout';
import type { EmailContent } from '../mail/email-layout';
import { EmailLog } from '../mail/email-log.entity';
import { EmailQuota } from '../mail/email-quota.service';
import { MailTransport } from '../mail/mail-transport.service';

const appName = () => process.env.APP_NAME || 'Clinic Portal';

/**
 * Account emails: sent straight away (they must work for a user with no
 * clinic, and the person is waiting), outside the notification outbox but
 * through the same SMTP transport and layout, and logged in `email_log`.
 * These are the only emails that may go to a not-yet-verified address —
 * they are how it gets verified. Every method resolves to whether the email
 * went out; none throws.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly transport: MailTransport,
    private readonly quota: EmailQuota,
    @InjectRepository(EmailLog) private readonly log: Repository<EmailLog>,
  ) {}

  sendEmailVerification(email: string, token: string, userId?: string) {
    return this.send('verify_email', email, userId, {
      eyebrow: 'Account',
      title: 'Confirm your email address',
      body: `Please confirm that ${email} is your email address. Once it is confirmed, you can keep using your account and receive notifications by email.`,
      note: 'The link works for 48 hours. If you did not expect this email, you can safely ignore it.',
      cta: {
        label: 'Verify email',
        url: appUrl(`/verify-email?token=${encodeURIComponent(token)}`),
      },
    });
  }

  sendPasswordReset(email: string, token: string, userId?: string) {
    return this.send('password_reset', email, userId, {
      eyebrow: 'Security',
      title: 'Reset your password',
      body: 'We got a request to reset the password of your account. Use the button below to choose a new one.',
      note: 'The link works for 15 minutes. If you did not ask for this, ignore this email — your password stays the same.',
      cta: {
        label: 'Choose a new password',
        url: appUrl(`/reset-password?token=${encodeURIComponent(token)}`),
      },
    });
  }

  /** "Your password was changed" and similar security notices. */
  sendSecurityNotice(
    kind: string,
    email: string,
    title: string,
    body: string,
    userId?: string,
  ) {
    return this.send(kind, email, userId, {
      eyebrow: 'Security',
      title,
      body,
      details: [
        {
          label: 'When',
          value:
            new Intl.DateTimeFormat('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'UTC',
            }).format(new Date()) + ' UTC',
        },
        { label: 'Account', value: email },
      ],
      note: 'If this was not you, reset your password right away and tell your clinic owner.',
      cta: { label: 'Sign in', url: appUrl('/login') },
    });
  }

  /** A lab's contact address: confirm it may receive order emails. */
  sendLabEmailConfirmation(email: string, labName: string, token: string) {
    return this.send('lab_email_confirm', email, undefined, {
      eyebrow: 'Lab',
      title: `Confirm the email address of ${labName}`,
      body: 'Clinics you work with will send new orders and order links to this address. Please confirm it is correct.',
      details: [
        { label: 'Lab', value: labName },
        { label: 'Email', value: email },
      ],
      note: 'The link works for 7 days. If this is not your lab, you can ignore this email.',
      cta: {
        label: 'Confirm email',
        url: appUrl(`/lab-email/confirm?token=${encodeURIComponent(token)}`),
      },
    });
  }

  private async send(
    kind: string,
    to: string,
    userId: string | undefined,
    content: Pick<
      EmailContent,
      'eyebrow' | 'title' | 'body' | 'details' | 'note' | 'cta'
    >,
  ): Promise<boolean> {
    const { html, text } = renderEmail({
      senderName: appName(),
      ...content,
      footer: `You get this email because of your ${appName()} account.`,
    });
    let status = 'sent';
    let error: string | null = null;
    let providerMessageId: string | null = null;
    try {
      if (!this.transport.isConfigured) status = 'not_configured';
      providerMessageId = await this.transport.send({
        to,
        subject: content.title,
        html,
        text,
      });
      if (status === 'sent') this.quota.recordSent();
    } catch (err) {
      status = 'failed';
      error = ((err as Error).message || 'Send failed').slice(0, 1000);
      this.logger.error(`${kind} email to ${to} failed: ${error}`);
    }
    await this.log
      .save(
        this.log.create({
          to,
          kind,
          status,
          userId: userId ?? null,
          providerMessageId,
          error,
        }),
      )
      .catch((e: Error) =>
        this.logger.warn(`email_log write failed: ${e.message}`),
      );
    return status === 'sent';
  }
}
