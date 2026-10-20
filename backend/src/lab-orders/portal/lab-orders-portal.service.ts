import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource } from 'typeorm';
import { PatientDataLevel } from 'src/labs/enums/lab.enums';
import type { LabActorContext } from 'src/labs/portal/lab-portal.constants';
import { LabScopedService } from 'src/labs/portal/lab-scoped';
import { orderError } from '../common/order-errors';
import { LabOrdersQueryDto } from '../dto/order.dto';
import { LabOrder } from '../entities/lab-order.entity';
import {
  LabOrderResponse,
  patientForLab,
  toLabOrder,
} from '../mappers/order-response';
import { OrderReaderService } from '../services/order-reader.service';

/**
 * Lab-side order reads (lab ERD inv. 2): every query starts from
 * `scoped()` — filtered by the member's lab — and drafts never show.
 * Responses use the lab mapper (no patient price, no internal files).
 */
@Injectable()
export class LabOrdersPortalService extends LabScopedService {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly reader: OrderReaderService,
  ) {
    super(dataSource);
  }

  async list(actor: LabActorContext, q: LabOrdersQueryDto) {
    const qb = this.scoped(LabOrder, 'o', actor)
      .innerJoinAndSelect('o.patient', 'p')
      .innerJoinAndSelect('o.labClinicLink', 'k')
      .innerJoinAndSelect('o.organization', 'org')
      .leftJoinAndSelect('o.doctor', 'd')
      .andWhere(`o.status_code <> 'draft'`);
    if (q.status) qb.andWhere('o.status_code = :status', { status: q.status });
    if (q.search) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('o.order_no ILIKE :s', { s: `%${q.search}%` })
            .orWhere('org.name ILIKE :s'),
        ),
      );
    }
    const [rows, total] = await qb
      .orderBy('o.submittedAt', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    return {
      data: rows.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        status: o.statusCode,
        priority: o.priority,
        clinic: { name: o.organization.name },
        patient: patientForLab(o.labClinicLink.patientDataLevel, o.patient),
        doctor: o.doctor ? { fullName: o.doctor.fullName } : null,
        labExpectedOn: o.labExpectedOn,
        submittedAt: o.submittedAt,
        currentRevisionNo: o.currentRevisionNo,
        version: o.version,
      })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  /** The order within the member's lab (never a draft), or 404. */
  async order(actor: LabActorContext, id: string): Promise<LabOrder> {
    const order = await this.scoped(LabOrder, 'o', actor)
      .innerJoinAndSelect('o.patient', 'p')
      .innerJoinAndSelect('o.lab', 'l')
      .innerJoinAndSelect('o.labClinicLink', 'k')
      .leftJoinAndSelect('o.doctor', 'd')
      .andWhere('o.id = :id', { id })
      .andWhere(`o.status_code <> 'draft'`)
      .getOne();
    if (!order) throw orderError('LAB_ORDER_NOT_FOUND', 'Order not found');
    return order;
  }

  async get(actor: LabActorContext, id: string): Promise<LabOrderResponse> {
    const order = await this.order(actor, id);
    const level: PatientDataLevel = order.labClinicLink.patientDataLevel;
    return toLabOrder(await this.reader.load(order), level);
  }
}
