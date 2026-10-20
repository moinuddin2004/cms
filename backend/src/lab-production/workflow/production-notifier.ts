import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { orderRecipients } from 'src/lab-orders/workflow/order-recipients';
import {
  NotificationAudience,
  RecipientType,
} from 'src/notifications/notifications.enums';
import {
  NotificationRecipient,
  NotificationService,
} from 'src/notifications/services/notification.service';

type Vars = Record<string, string | number | null | undefined>;

/**
 * Production notifications (lab ERD §7): outbox rows in the caller's
 * transaction via `NotificationService.enqueue` — never a direct send.
 * Lab members get a portal link, the ordering doctor a clinic link.
 */
@Injectable()
export class ProductionNotifier {
  constructor(private readonly notifications: NotificationService) {}

  async toLab(
    m: EntityManager,
    orderId: string,
    eventCode: string,
    variables: Vars = {},
    entity?: { type: string; id: string },
  ): Promise<void> {
    await this.send(
      m,
      orderId,
      eventCode,
      NotificationAudience.LAB,
      variables,
      {
        entity,
      },
    );
  }

  async toDoctor(
    m: EntityManager,
    orderId: string,
    eventCode: string,
    variables: Vars = {},
    opts: { patient?: boolean; entity?: { type: string; id: string } } = {},
  ): Promise<void> {
    await this.send(
      m,
      orderId,
      eventCode,
      NotificationAudience.DOCTOR,
      variables,
      opts,
    );
  }

  private async send(
    m: EntityManager,
    orderId: string,
    eventCode: string,
    audience: NotificationAudience,
    variables: Vars,
    opts: { patient?: boolean; entity?: { type: string; id: string } },
  ): Promise<void> {
    const who = await orderRecipients(m, orderId);
    const recipients: NotificationRecipient[] = who.recipients.filter(
      (r) => r.audience === audience,
    );
    if (opts.patient) {
      const [o] = await sqlRows<{ patient_id: string }>(
        m,
        `SELECT patient_id FROM lab_orders WHERE id = $1`,
        [orderId],
      );
      recipients.push({
        audience: NotificationAudience.PATIENT,
        type: RecipientType.PATIENT,
        id: o.patient_id,
      });
    }
    if (!recipients.length) return;
    const [o] = await sqlRows<{ organization_id: string }>(
      m,
      `SELECT organization_id FROM lab_orders WHERE id = $1`,
      [orderId],
    );
    await this.notifications.enqueue(m, {
      organizationId: o.organization_id,
      locationId: who.locationId,
      eventCode,
      recipients,
      variables: { ...who.variables, ...variables },
      link:
        audience === NotificationAudience.LAB
          ? who.link
          : `/lab-orders/${orderId}`,
      entity: opts.entity ?? { type: 'order', id: orderId },
    });
  }
}
