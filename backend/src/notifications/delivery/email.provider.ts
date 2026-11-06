import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { appUrl, renderEmail } from 'src/common/mail/email-layout';
import { EmailQuota } from 'src/common/mail/email-quota.service';
import {
  MailTransport,
  PermanentMailError,
} from 'src/common/mail/mail-transport.service';
import {
  NotificationChannel,
  OutboxStatus,
  RecipientType,
} from '../notifications.enums';
import { AddressVerifier } from './address-verifier';
import {
  ChannelProvider,
  DeferSendError,
  OutgoingNotification,
  PermanentSendError,
  SendResult,
  SkipSendError,
} from './channel-provider';

/** Where a user switches their own notification emails on / off. */
export const MY_NOTIFICATIONS_PATH = '/settings/my-notifications';

/**
 * The real email channel (P3), replacing the dev-log stand-in when SMTP is
 * configured. Before sending it re-checks the address is verified
 * (→ `skipped_unverified`) and the daily cap (→ requeued for tomorrow).
 * Rendered in the shared layout with the clinic's name and theme colour.
 */
@Injectable()
export class EmailChannelProvider implements ChannelProvider {
  readonly name = 'smtp';
  readonly channels = [NotificationChannel.EMAIL] as const;
  private readonly brandCache = new Map<
    string,
    { color: string | null; logo: string | null; at: number }
  >();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly transport: MailTransport,
    private readonly quota: EmailQuota,
    private readonly verifier: AddressVerifier,
  ) {}

  get enabled(): boolean {
    return this.transport.isConfigured;
  }

  async send(n: OutgoingNotification): Promise<SendResult> {
    const to = n.payload.to;
    if (!to) throw new PermanentSendError('No recipient address');
    if (!(await this.verifier.isVerified(n.recipientType, n.recipientId, to))) {
      throw new SkipSendError(
        OutboxStatus.SKIPPED_UNVERIFIED,
        `${to} is not a verified address`,
      );
    }
    if (!(await this.quota.hasRoom())) {
      throw new DeferSendError(
        this.quota.nextWindow(),
        `Daily email limit (${this.quota.cap}) reached; sending tomorrow`,
      );
    }

    const clinic = n.payload.variables?.clinic_name || 'Your clinic';
    const isUser = n.recipientType === RecipientType.USER;
    const manageUrl = isUser ? appUrl(MY_NOTIFICATIONS_PATH) : null;
    const brand = await this.brand(n.organizationId);
    const { html, text } = renderEmail({
      senderName: clinic,
      brandColor: brand.color,
      logoUrl: brand.logo,
      eyebrow: eyebrowFor(n.eventCode),
      title: n.payload.title || clinic,
      body: n.payload.body,
      cta: n.payload.link
        ? { label: ctaLabelFor(n.eventCode), url: appUrl(n.payload.link) }
        : null,
      footer: isUser
        ? `You get this email because you work with ${clinic}. In-app notifications are in the bell.`
        : `You get this email because ${clinic} works with you.`,
      manageUrl,
    });
    try {
      const id = await this.transport.send({
        to,
        subject: n.payload.title || clinic,
        html,
        text,
        headers: manageUrl
          ? { 'List-Unsubscribe': `<${manageUrl}>` }
          : undefined,
      });
      this.quota.recordSent();
      return { providerMessageId: id };
    } catch (err) {
      if (err instanceof PermanentMailError) {
        throw new PermanentSendError(err.message);
      }
      throw err;
    }
  }

  /** The clinic's theme colour and logo (config_values), cached 10 minutes. */
  private async brand(
    orgId: string,
  ): Promise<{ color: string | null; logo: string | null }> {
    const hit = this.brandCache.get(orgId);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit;
    const rows = await sqlRows<{ key: string; value: unknown }>(
      this.dataSource,
      `SELECT key, value FROM config_values
        WHERE scope_type = 'org' AND scope_id = $1
          AND key IN ('theme.brand_color', 'theme.logo_url')`,
      [orgId],
    );
    const get = (k: string) => {
      const v = rows.find((r) => r.key === k)?.value;
      return typeof v === 'string' ? v : null;
    };
    const value = {
      color: get('theme.brand_color'),
      logo: get('theme.logo_url'),
      at: Date.now(),
    };
    this.brandCache.set(orgId, value);
    return value;
  }
}

/** Small label above the title, by event family. */
export function eyebrowFor(eventCode: string): string {
  const family = eventCode.split('.')[0];
  const labels: Record<string, string> = {
    order: 'Lab order',
    item: 'Lab order',
    stage: 'Lab order',
    remake: 'Lab order',
    shipment: 'Lab shipment',
    appointment: 'Appointment',
    queue: 'Queue',
    inventory: 'Inventory',
    join_request: 'Team',
    employee: 'Team',
    clinic: 'Your clinic',
    subscription: 'Subscription',
    payroll: 'Payroll',
  };
  return labels[family] ?? 'Notification';
}

/** Button text by event family ("Open" when nothing fits). */
export function ctaLabelFor(eventCode: string): string {
  const family = eventCode.split('.')[0];
  const labels: Record<string, string> = {
    order: 'View order',
    item: 'View order',
    stage: 'View order',
    remake: 'View order',
    shipment: 'View shipment',
    appointment: 'View appointments',
    queue: 'Open my queue',
    inventory: 'View inventory',
    join_request: 'Review request',
    employee: 'Sign in',
    clinic: 'Open your clinic',
    subscription: 'Renew subscription',
    payroll: 'View payslip',
  };
  if (eventCode === 'join_request.approved') return 'Sign in';
  return labels[family] ?? 'Open';
}
