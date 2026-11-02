import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { OrderLifecycleHooks } from 'src/lab-orders/workflow/order-hooks';
import { orderRecipients } from 'src/lab-orders/workflow/order-recipients';
import {
  NotificationAudience,
  RecipientType,
} from 'src/notifications/notifications.enums';
import {
  EnqueuedNotification,
  NotificationService,
} from 'src/notifications/services/notification.service';
import { formatPkr } from '../common/lab-billing-math';

/**
 * Patient notifications for lab work and lab billing (lab ERD §16). Every
 * message is an outbox row written in the caller's transaction via
 * `NotificationService.enqueue`, which applies the §7 decision order:
 * patient audience OFF by default → `skipped_disabled`; patient opt-out →
 * `skipped_opt_out`; quiet hours → held. Nothing is sent from here.
 *
 * Events: `payment.receipt` (a lab payment), `payment.outstanding_reminder`
 * (on request), `order.completed` (case complete — doctor + patient).
 * `item.ready` already reaches the patient from production (Sprint 8).
 */
@Injectable()
export class LabPatientNotifier implements OnModuleInit {
  constructor(
    private readonly notifications: NotificationService,
    private readonly hooks: OrderLifecycleHooks,
  ) {}

  onModuleInit(): void {
    this.hooks.onStateChanged(async (m, orderId, toState) => {
      if (toState === 'completed') await this.caseComplete(m, orderId);
    });
  }

  receipt(
    m: EntityManager,
    p: {
      organizationId: string;
      locationId: string;
      patientId: string;
      paymentId: string;
      receiptNo: string;
      amountMinor: number;
    },
  ): Promise<EnqueuedNotification[]> {
    return this.notifications.enqueue(m, {
      organizationId: p.organizationId,
      locationId: p.locationId,
      eventCode: 'payment.receipt',
      recipients: [this.patient(p.patientId)],
      variables: { receipt_no: p.receiptNo, amount: formatPkr(p.amountMinor) },
      entity: { type: 'lab_payment', id: p.paymentId },
    });
  }

  reminder(
    m: EntityManager,
    inv: {
      organizationId: string;
      locationId: string;
      patientId: string;
      id: string;
      balanceMinor: number;
    },
  ): Promise<EnqueuedNotification[]> {
    return this.notifications.enqueue(m, {
      organizationId: inv.organizationId,
      locationId: inv.locationId,
      eventCode: 'payment.outstanding_reminder',
      recipients: [this.patient(inv.patientId)],
      variables: { amount: formatPkr(inv.balanceMinor) },
      entity: { type: 'lab_invoice', id: inv.id },
    });
  }

  /** Order completed: the ordering doctor (in-app) and the patient. */
  private async caseComplete(m: EntityManager, orderId: string): Promise<void> {
    const who = await orderRecipients(m, orderId);
    const [o] = await sqlRows<{ organization_id: string; patient_id: string }>(
      m,
      `SELECT organization_id, patient_id FROM lab_orders WHERE id = $1`,
      [orderId],
    );
    await this.notifications.enqueue(m, {
      organizationId: o.organization_id,
      locationId: who.locationId,
      eventCode: 'order.completed',
      recipients: [
        ...who.recipients.filter(
          (r) => r.audience === NotificationAudience.DOCTOR,
        ),
        this.patient(o.patient_id),
      ],
      variables: { order_no: String(who.variables?.order_no ?? '') },
      link: `/lab-orders/${orderId}`,
      entity: { type: 'order', id: orderId },
    });
  }

  private patient(id: string) {
    return {
      audience: NotificationAudience.PATIENT,
      type: RecipientType.PATIENT,
      id,
    };
  }
}
