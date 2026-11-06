import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers, e.g. `List-Unsubscribe`. */
  headers?: Record<string, string>;
}

/** Thrown when the mailbox can never receive (bad address): retrying won't help. */
export class PermanentMailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentMailError';
  }
}

/**
 * The one SMTP connection (docs/notifications-email-plan.md, P3). Any free
 * SMTP works by env only — no code change to switch provider:
 * - `SMTP_HOST` (+ `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`):
 *   Brevo, SMTP2GO, Mailjet, Google Workspace relay, …
 * - only `SMTP_USER` / `SMTP_PASS`: Gmail with an app password (the old setup).
 * - neither: not configured — callers fall back to logging.
 * `SMTP_FROM` is the sender (`"Clinic Portal <no-reply@x.com>"`); with Gmail it
 * must be the Gmail address itself (the display name may differ).
 */
@Injectable()
export class MailTransport {
  private readonly logger = new Logger(MailTransport.name);
  private transporter: Transporter | null = null;
  private built = false;

  get isConfigured(): boolean {
    return !!(process.env.SMTP_HOST || process.env.SMTP_USER);
  }

  get from(): string {
    const name =
      process.env.SMTP_FROM_NAME || process.env.APP_NAME || 'Clinic Portal';
    const address = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    return address.includes('<') ? address : `"${name}" <${address}>`;
  }

  private get client(): Transporter | null {
    if (this.built) return this.transporter;
    this.built = true;
    if (!this.isConfigured) return null;
    const auth =
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined;
    this.transporter = process.env.SMTP_HOST
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth,
        })
      : nodemailer.createTransport({ service: 'gmail', auth });
    return this.transporter;
  }

  /** Sends one email; returns the provider message id. Not configured → logs and returns null. */
  async send(mail: OutgoingMail): Promise<string | null> {
    const client = this.client;
    if (!client) {
      this.logger.log(`[email:not-configured] → ${mail.to}: ${mail.subject}`);
      return null;
    }
    try {
      const info = (await client.sendMail({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: mail.headers,
      })) as { messageId?: string };
      return info.messageId ?? null;
    } catch (err) {
      const e = err as { responseCode?: number; message?: string };
      // 550–554 = this recipient is refused for good (no such mailbox, …).
      // Other errors — incl. 535 bad SMTP login — are our setup or a hiccup:
      // retried, so mail goes out once the settings are fixed.
      if (e.responseCode && e.responseCode >= 550 && e.responseCode <= 554) {
        throw new PermanentMailError(e.message ?? 'Recipient refused');
      }
      throw err;
    }
  }
}
