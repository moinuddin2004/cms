import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuditService, TimelineEntry } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { localDate } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { FormSchemaVersion } from 'src/engine/entities/form-schema-version.entity';
import { LabService } from 'src/lab-catalog/entities/lab-service.entity';
import {
  DentalItemDetails,
  ItemFormResponse,
  ItemTooth,
} from '../entities/item-parts.entity';
import { Attachment } from '../entities/attachment.entity';
import { LabOrderItem } from '../entities/lab-order-item.entity';
import { LabOrder } from '../entities/lab-order.entity';
import {
  OrderChargeRequest,
  OrderMessage,
  OrderRevision,
} from '../entities/order-records.entity';
import { ORDER_ENTITY } from '../enums/order.enums';
import {
  appointmentWarning,
  estimateExpectedOn,
  OrderWarning,
} from '../submit/order-lines';

/** Everything about one order, read once; mappers pick what each side sees. */
export interface OrderBundle {
  order: LabOrder;
  clinicName: string;
  items: LabOrderItem[];
  services: Map<string, LabService>;
  answers: Map<string, ItemFormResponse>;
  forms: Map<string, FormSchemaVersion>;
  teeth: ItemTooth[];
  details: Map<string, DentalItemDetails>;
  revisions: OrderRevision[];
  messages: OrderMessage[];
  charges: OrderChargeRequest[];
  attachments: Attachment[];
  userNames: Map<string, string>;
  history: TimelineEntry[];
}

const none = <T>(): Promise<T[]> => Promise.resolve([]);

/** Statuses after which the appointment check no longer matters. */
const CLOSED = new Set(['completed', 'cancelled', 'under_review']);

@Injectable()
export class OrderReaderService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  async load(
    order: LabOrder,
    m: EntityManager = this.dataSource.manager,
  ): Promise<OrderBundle> {
    const items = await m
      .getRepository(LabOrderItem)
      .find({ where: { orderId: order.id }, order: { lineNo: 'ASC' } });
    const itemIds = items.map((i) => i.id);
    const formIds = [
      ...new Set(
        items.map((i) => i.formSchemaVersionId).filter((x): x is string => !!x),
      ),
    ];
    const [
      services,
      answers,
      forms,
      teeth,
      details,
      revisions,
      messages,
      charges,
      attachments,
      clinic,
    ] = await Promise.all([
      m
        .getRepository(LabService)
        .findBy({ id: In(items.map((i) => i.labServiceId)) }),
      itemIds.length
        ? m.getRepository(ItemFormResponse).findBy({ itemId: In(itemIds) })
        : none<ItemFormResponse>(),
      formIds.length
        ? m.getRepository(FormSchemaVersion).find({
            where: { id: In(formIds) },
            relations: { formSchema: true },
          })
        : none<FormSchemaVersion>(),
      itemIds.length
        ? m.getRepository(ItemTooth).findBy({ itemId: In(itemIds) })
        : none<ItemTooth>(),
      itemIds.length
        ? m.getRepository(DentalItemDetails).findBy({ itemId: In(itemIds) })
        : none<DentalItemDetails>(),
      m
        .getRepository(OrderRevision)
        .find({ where: { orderId: order.id }, order: { revisionNo: 'ASC' } }),
      m
        .getRepository(OrderMessage)
        .find({ where: { orderId: order.id }, order: { createdAt: 'ASC' } }),
      m
        .getRepository(OrderChargeRequest)
        .find({ where: { orderId: order.id }, order: { createdAt: 'ASC' } }),
      m
        .getRepository(Attachment)
        .find({ where: { orderId: order.id }, order: { createdAt: 'ASC' } }),
      sqlRows<{ name: string }>(
        m,
        `SELECT name FROM organizations WHERE id = $1`,
        [order.organizationId],
      ),
    ]);
    const userIds = [
      ...new Set(
        [
          ...messages.map((x) => x.authorUserId),
          ...revisions.map((x) => x.createdBy),
          ...charges.flatMap((x) => [x.requestedBy, x.decidedBy]),
          ...attachments.map((x) => x.uploadedBy),
        ].filter((x): x is string => !!x),
      ),
    ];
    const users = userIds.length
      ? await sqlRows<{ uuid: string; name: string }>(
          m,
          `SELECT uuid, COALESCE(name, email) AS name FROM users WHERE uuid = ANY($1)`,
          [userIds],
        )
      : [];
    return {
      order,
      clinicName: clinic[0]?.name ?? '',
      items,
      services: new Map(services.map((s) => [s.id, s])),
      answers: new Map(answers.map((a) => [a.itemId, a])),
      forms: new Map(forms.map((f) => [f.id, f])),
      teeth,
      details: new Map(details.map((d) => [d.itemId, d])),
      revisions,
      messages,
      charges,
      attachments,
      userNames: new Map(users.map((u) => [u.uuid, u.name])),
      history: await this.audit.timeline(
        m,
        ORDER_ENTITY.ORDER,
        order.id,
        order.organizationId,
      ),
    };
  }

  /**
   * Lab ERD §14.3: the work is due after the patient's next appointment.
   * Drafts use the estimate submit would set.
   */
  async warnings(b: OrderBundle): Promise<OrderWarning[]> {
    const { order } = b;
    if (CLOSED.has(order.statusCode)) return [];
    const tz = await this.clock.timezoneFor(order.locationId);
    const due =
      order.labExpectedOn ??
      estimateExpectedOn(
        this.clock.today(tz),
        b.items.map(
          (i) => b.services.get(i.labServiceId)?.defaultTurnaroundDays ?? 0,
        ),
        order.requestedOn,
      );
    const [next] = await sqlRows<{ id: string; start_time: Date }>(
      this.dataSource,
      `SELECT id, start_time FROM appointments
        WHERE patient_id = $1 AND organization_id = $2
          AND status IN ('scheduled', 'confirmed') AND start_time > now()
        ORDER BY start_time ASC LIMIT 1`,
      [order.patientId, order.organizationId],
    );
    const w = appointmentWarning(
      due,
      next
        ? { id: next.id, on: localDate(tz, new Date(next.start_time)) }
        : null,
    );
    return w ? [w] : [];
  }
}
