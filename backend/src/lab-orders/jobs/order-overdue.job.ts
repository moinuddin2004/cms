import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { NotificationService } from 'src/notifications/services/notification.service';
import { NotificationAudience } from 'src/notifications/notifications.enums';
import { ORDER_ENTITY } from '../enums/order.enums';
import { orderRecipients } from '../workflow/order-recipients';

/** Orders still owed by the lab: not ready, received, done or cancelled. */
const NOT_OVERDUE = `('draft', 'cancelled', 'completed', 'rejected_by_lab',
  'ready', 'partially_received', 'under_review')`;

/**
 * `order.overdue` (lab ERD §7): tells the ordering doctor when an order's
 * expected date has passed on the LOCATION's calendar and the work isn't
 * ready. Hourly so every timezone hears soon after its midnight; one
 * notification per order until the order changes (e.g. a new expected date
 * from the lab bumps `updated_at`, and a later miss is told again).
 */
@Injectable()
export class OrderOverdueJob {
  private readonly logger = new Logger(OrderOverdueJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationService,
  ) {}

  @Cron('5 * * * *', { name: 'lab-order-overdue' })
  async run(): Promise<number> {
    const due = await sqlRows<{ id: string; lab_name: string }>(
      this.dataSource.manager,
      `SELECT o.id, lab.name AS lab_name
         FROM lab_orders o
         JOIN locations loc ON loc.id = o.location_id
         JOIN labs lab ON lab.id = o.lab_id
        WHERE o.status_code NOT IN ${NOT_OVERDUE}
          AND o.lab_expected_on IS NOT NULL
          AND o.lab_expected_on < (now() AT TIME ZONE COALESCE(loc.timezone, 'UTC'))::date
          AND NOT EXISTS (
                SELECT 1 FROM notification_outbox n
                 WHERE n.event_code = 'order.overdue'
                   AND n.entity_id = o.id
                   AND n.created_at > o.updated_at)
        LIMIT 500`,
    );
    let sent = 0;
    for (const o of due) {
      try {
        await this.dataSource.transaction(async (m) => {
          const who = await orderRecipients(m, o.id);
          const recipients = who.recipients.filter(
            (r) => r.audience === NotificationAudience.DOCTOR,
          );
          if (!recipients.length) return;
          const [order] = await sqlRows<{ organization_id: string }>(
            m,
            `SELECT organization_id FROM lab_orders WHERE id = $1`,
            [o.id],
          );
          await this.notifications.enqueue(m, {
            organizationId: order.organization_id,
            locationId: who.locationId,
            eventCode: 'order.overdue',
            recipients,
            variables: {
              ...who.variables,
              lab_name: o.lab_name,
              expected_on: who.variables?.due_on,
            },
            link: `/lab-orders/${o.id}`,
            entity: { type: ORDER_ENTITY.ORDER, id: o.id },
          });
          sent++;
        });
      } catch (err) {
        this.logger.warn(
          `order.overdue for ${o.id} failed: ${(err as Error).message}`,
        );
      }
    }
    if (sent) this.logger.log(`order.overdue sent for ${sent} order(s)`);
    return sent;
  }
}
