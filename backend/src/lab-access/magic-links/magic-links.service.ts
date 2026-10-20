import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import type { ClinicCall } from 'src/lab-orders/common/order-context';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { OrderLifecycleHooks } from 'src/lab-orders/workflow/order-hooks';
import { orderRecipients } from 'src/lab-orders/workflow/order-recipients';
import { Lab } from 'src/labs/entities/lab.entity';
import { LabStatus } from 'src/labs/enums/lab.enums';
import { PermanentSendError } from 'src/notifications/delivery/channel-provider';
import type { OutgoingNotification } from 'src/notifications/delivery/channel-provider';
import { PayloadFinalizers } from 'src/notifications/delivery/payload-finalizers';
import type { NotificationPayload } from 'src/notifications/entities/notification-outbox.entity';
import {
  NotificationAudience,
  RecipientType,
} from 'src/notifications/notifications.enums';
import { NotificationService } from 'src/notifications/services/notification.service';
import { accessError } from '../common/access-errors';
import {
  MagicLink,
  MagicLinkDelivery,
  MagicLinkPurpose,
} from '../entities/magic-link.entity';
import {
  hashToken,
  isTokenShaped,
  magicLinkUrl,
  newNonce,
  tokenFor,
  ttlHours,
  URL_PLACEHOLDER,
  urlPlaceholder,
} from './magic-link-token';

export const MAGIC_LINK_EVENT = 'order.magic_link';
export const MAGIC_LINK_ENTITY = 'magic_link';

/** Order states in which a link is dead (and gets revoked). */
export const CLOSED_ORDER_STATES = new Set([
  'completed',
  'cancelled',
  'rejected_by_lab',
]);

export interface IssueInput {
  order: LabOrder;
  createdBy: string | null;
  ref: ActorRef;
  delivery: MagicLinkDelivery;
  purpose?: MagicLinkPurpose;
  expiresInHours?: number;
}

/** A link the caller may use right now, with its order. */
export interface ResolvedLink {
  link: MagicLink;
  order: LabOrder;
}

export type MagicLinkState = 'active' | 'expired' | 'revoked' | 'used_up';

/**
 * Magic links (lab ERD §7, §13 "Lab access"): one order, one lab, no login.
 * Created at submit (when the lab has a WhatsApp / phone / email) and on
 * demand by the clinic; the message goes through the notification outbox
 * with a placeholder, and the worker puts the URL in at send time — so the
 * token exists nowhere in the database. Closing an order revokes its links.
 */
@Injectable()
export class MagicLinksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly notifications: NotificationService,
    hooks: OrderLifecycleHooks,
    finalizers: PayloadFinalizers,
  ) {
    hooks.onSubmitted((m, order, call) => this.onSubmitted(m, order, call));
    hooks.onStateChanged(async (m, orderId, to) => {
      if (CLOSED_ORDER_STATES.has(to)) {
        await this.revokeForOrder(m, orderId, 'order_closed');
      }
    });
    finalizers.register(MAGIC_LINK_EVENT, (n) => this.finalize(n));
  }

  /** §10 submit: send the lab its link when it has an address for it. */
  private async onSubmitted(
    m: EntityManager,
    order: LabOrder,
    call: ClinicCall,
  ): Promise<void> {
    const lab = await m.getRepository(Lab).findOneByOrFail({ id: order.labId });
    if (!lab.whatsappPhone && !lab.phone && !lab.email) return;
    await this.issue(m, {
      order,
      createdBy: call.actor.userId,
      ref: call.ref,
      delivery: MagicLinkDelivery.NOTIFICATION,
    });
  }

  /** New link; the URL comes back only for `copy` (otherwise the outbox carries it). */
  async issue(
    m: EntityManager,
    input: IssueInput,
  ): Promise<{ link: MagicLink; url: string | null }> {
    const { order } = input;
    const lab = await m.getRepository(Lab).findOneByOrFail({ id: order.labId });
    const nonce = newNonce();
    const token = tokenFor(nonce);
    const hours = input.expiresInHours ?? ttlHours();
    const phone = lab.whatsappPhone || lab.phone || null;
    const link = await m.getRepository(MagicLink).save({
      organizationId: order.organizationId,
      tokenHash: hashToken(token),
      nonce,
      purpose: input.purpose ?? MagicLinkPurpose.LAB_UPDATE_ORDER,
      labId: order.labId,
      orderId: order.id,
      shipmentId: null,
      recipientPhone:
        input.delivery === MagicLinkDelivery.NOTIFICATION ? phone : null,
      delivery: input.delivery,
      expiresAt: new Date(this.clock.now().getTime() + hours * 3_600_000),
      maxUses: null,
      usedCount: 0,
      createdBy: input.createdBy,
    });
    await this.audit.record(m, input.ref, {
      organizationId: order.organizationId,
      entityType: MAGIC_LINK_ENTITY,
      entityId: link.id,
      action: AuditAction.CREATE,
      after: {
        orderId: order.id,
        labId: order.labId,
        purpose: link.purpose,
        delivery: link.delivery,
        expiresAt: link.expiresAt.toISOString(),
      },
    });

    if (input.delivery === MagicLinkDelivery.NOTIFICATION) {
      const who = await orderRecipients(m, order.id);
      const tz = await this.clock.timezoneFor(order.locationId);
      await this.notifications.enqueue(m, {
        organizationId: order.organizationId,
        locationId: who.locationId,
        eventCode: MAGIC_LINK_EVENT,
        recipients: [
          {
            audience: NotificationAudience.LAB,
            type: RecipientType.LAB,
            id: lab.id,
            name: lab.name,
            phone,
            email: lab.email,
          },
        ],
        variables: {
          ...who.variables,
          magic_link_url: urlPlaceholder(link.id),
          expires_at: formatInstant(link.expiresAt, tz),
        },
        link: null,
        entity: { type: MAGIC_LINK_ENTITY, id: link.id },
      });
    }
    return {
      link,
      url:
        input.delivery === MagicLinkDelivery.COPY ? magicLinkUrl(token) : null,
    };
  }

  /** Clinic view of an order's links, with how each message went. */
  async forOrder(organizationId: string, orderId: string) {
    const links = await this.dataSource.getRepository(MagicLink).find({
      where: { organizationId, orderId },
      order: { createdAt: 'DESC' },
    });
    const deliveries = links.length
      ? await sqlRows<{
          entity_id: string;
          channel: string;
          status: string;
          to: string | null;
          reason: string | null;
          last_error: string | null;
          sent_at: Date | null;
        }>(
          this.dataSource,
          `SELECT entity_id, channel, status, payload->>'to' AS "to",
                  payload->>'reason' AS reason, last_error, sent_at
             FROM notification_outbox
            WHERE entity_type = $1 AND entity_id = ANY($2::uuid[])
            ORDER BY created_at`,
          [MAGIC_LINK_ENTITY, links.map((l) => l.id)],
        )
      : [];
    const now = this.clock.now();
    return links.map((l) => ({
      id: l.id,
      purpose: l.purpose,
      delivery: l.delivery,
      state: linkState(l, now),
      recipientPhone: l.recipientPhone,
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      revokedAt: l.revokedAt,
      revokedReason: l.revokedReason,
      usedCount: l.usedCount,
      lastUsedAt: l.lastUsedAt,
      lastViewedAt: l.lastViewedAt,
      deliveries: deliveries
        .filter((d) => d.entity_id === l.id)
        .map((d) => ({
          channel: d.channel,
          status: d.status,
          to: d.to,
          reason: d.reason,
          lastError: d.last_error,
          sentAt: d.sent_at,
        })),
    }));
  }

  async revoke(
    organizationId: string,
    orderId: string,
    linkId: string,
    ref: ActorRef,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const link = await m.getRepository(MagicLink).findOne({
        where: { id: linkId, orderId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!link)
        throw accessError('MAGIC_LINK_NOT_FOUND', 'Magic link not found');
      if (link.revokedAt) return;
      link.revokedAt = this.clock.now();
      link.revokedReason = 'revoked_by_clinic';
      link.revokedBy = ref.userId;
      await m.getRepository(MagicLink).save(link);
      await this.audit.record(m, ref, {
        organizationId,
        entityType: MAGIC_LINK_ENTITY,
        entityId: link.id,
        action: AuditAction.VOID,
        before: { revokedAt: null },
        after: {
          revokedAt: link.revokedAt.toISOString(),
          reason: 'revoked_by_clinic',
        },
      });
    });
  }

  /** Called when an order closes (in its transaction). */
  async revokeForOrder(
    m: EntityManager,
    orderId: string,
    reason: string,
  ): Promise<void> {
    await m.query(
      `UPDATE magic_links SET revoked_at = now(), revoked_reason = $2
        WHERE order_id = $1 AND revoked_at IS NULL`,
      [orderId, reason],
    );
  }

  /**
   * The link behind a token, checked (lab ERD §19: an expired or revoked
   * link does nothing). Unknown / malformed → 404; expired, used up,
   * revoked, closed order or inactive lab → 410. `lock` row-locks the link
   * for an action (use inside a transaction).
   */
  async resolve(
    token: string,
    m: EntityManager = this.dataSource.manager,
    lock = false,
  ): Promise<ResolvedLink> {
    if (!isTokenShaped(token)) {
      throw accessError('MAGIC_LINK_INVALID', 'This link is not valid');
    }
    const link = await m.getRepository(MagicLink).findOne({
      where: { tokenHash: hashToken(token) },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!link)
      throw accessError('MAGIC_LINK_INVALID', 'This link is not valid');
    const state = linkState(link, this.clock.now());
    if (state === 'revoked') {
      throw accessError('MAGIC_LINK_REVOKED', 'This link was withdrawn');
    }
    if (state !== 'active') {
      throw accessError('MAGIC_LINK_EXPIRED', 'This link has expired');
    }
    const order = await m.getRepository(LabOrder).findOne({
      where: { id: link.orderId, labId: link.labId },
      relations: {
        patient: true,
        lab: true,
        labClinicLink: true,
        doctor: true,
      },
    });
    if (
      !order ||
      CLOSED_ORDER_STATES.has(order.statusCode) ||
      order.lab.status !== LabStatus.ACTIVE
    ) {
      throw accessError('MAGIC_LINK_REVOKED', 'This link was withdrawn');
    }
    return { link, order };
  }

  async markViewed(linkId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE magic_links SET last_viewed_at = now() WHERE id = $1`,
      [linkId],
    );
  }

  /** One more action through the link (inside the action's transaction). */
  async markUsed(m: EntityManager, linkId: string): Promise<void> {
    await m.query(
      `UPDATE magic_links SET used_count = used_count + 1, last_used_at = now()
        WHERE id = $1`,
      [linkId],
    );
  }

  /**
   * Worker side: swap the placeholder for the real URL just before sending.
   * A link revoked or expired since enqueue is not sent at all.
   */
  private async finalize(
    n: OutgoingNotification,
  ): Promise<NotificationPayload> {
    const swap = async (text: string | null): Promise<string | null> => {
      if (!text) return text;
      let out = text;
      for (const [placeholder, id] of [...text.matchAll(URL_PLACEHOLDER)].map(
        (x) => [x[0], x[1]] as const,
      )) {
        out = out.split(placeholder).join(await this.urlOf(id));
      }
      return out;
    };
    const variables: Record<string, string> = {};
    for (const [k, v] of Object.entries(n.payload.variables ?? {})) {
      variables[k] = (await swap(v)) ?? v;
    }
    return {
      ...n.payload,
      title: await swap(n.payload.title),
      body: (await swap(n.payload.body)) ?? '',
      variables,
    };
  }

  private async urlOf(linkId: string): Promise<string> {
    const link = await this.dataSource
      .getRepository(MagicLink)
      .createQueryBuilder('l')
      .addSelect('l.nonce')
      .where('l.id = :linkId', { linkId })
      .getOne();
    if (!link || linkState(link, this.clock.now()) !== 'active') {
      throw new PermanentSendError(
        'Magic link revoked or expired before sending',
      );
    }
    return magicLinkUrl(tokenFor(link.nonce));
  }
}

export function linkState(
  l: Pick<MagicLink, 'revokedAt' | 'expiresAt' | 'maxUses' | 'usedCount'>,
  now: Date,
): MagicLinkState {
  if (l.revokedAt) return 'revoked';
  if (l.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (l.maxUses !== null && l.usedCount >= l.maxUses) return 'used_up';
  return 'active';
}

const formatInstant = (at: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
