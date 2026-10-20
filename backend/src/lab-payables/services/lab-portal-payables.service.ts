import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Not } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { LabScopedService } from 'src/labs/portal/lab-scoped';
import type { LabActorContext } from 'src/labs/portal/lab-portal.constants';
import { payablesError } from '../common/payables-errors';
import {
  toAllocation,
  toBill,
  toBillLine,
  toPayment,
  toStatement,
  toStatementLine,
} from '../common/payables-response';
import {
  BillsQueryDto,
  PaymentsQueryDto,
  StatementsQueryDto,
} from '../dto/payables.dto';
import {
  LabStatement,
  LabStatementLine,
} from '../entities/lab-statement.entity';
import { VendorBill, VendorBillLine } from '../entities/vendor-bill.entity';
import {
  VendorPayment,
  VendorPaymentAllocation,
} from '../entities/vendor-payment.entity';
import { VendorBillStatus } from '../enums/payables.enums';

/**
 * The lab's read-only view of what clinics owe it (lab ERD §6b, inv. 2):
 * approved bills (drafts are the clinic's working copy), payments and
 * statements, every query filtered by the member's lab. Bills carry only
 * lab costs; clinic selling prices are never read here.
 */
@Injectable()
export class LabPortalPayablesService extends LabScopedService {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource);
  }

  async bills(actor: LabActorContext, q: BillsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.scoped(VendorBill, 'b', actor)
      .andWhere('b.status <> :draft', { draft: VendorBillStatus.DRAFT })
      .orderBy('b.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (q.status) qb.andWhere('b.status = :status', { status: q.status });
    if (q.open === 'true') qb.andWhere('b.balance_paisa > 0');
    if (q.search?.trim())
      qb.andWhere('(b.bill_no ILIKE :s OR b.vendor_invoice_no ILIKE :s)', {
        s: `%${q.search.trim()}%`,
      });
    const [rows, total] = await qb.getManyAndCount();
    const names = await this.names(
      rows.map((b) => b.organizationId),
      rows.map((b) => b.labOrderId),
    );
    return PaginatedResponseDto.create(
      rows.map((b) =>
        toBill(
          b,
          {
            clinicName: names.clinics.get(b.organizationId),
            orderNo: b.labOrderId ? names.orders.get(b.labOrderId) : null,
          },
          'lab',
        ),
      ),
      total,
      page,
      limit,
    );
  }

  async bill(actor: LabActorContext, id: string) {
    const m = this.dataSource.manager;
    const b = await m.getRepository(VendorBill).findOneBy({
      id,
      labId: actor.labId,
      status: Not(VendorBillStatus.DRAFT),
    });
    if (!b) throw payablesError('PAYABLES_BILL_NOT_FOUND', 'Bill not found');
    const [lines, allocations, names] = await Promise.all([
      m.getRepository(VendorBillLine).find({
        where: { vendorBillId: b.id },
        order: { createdAt: 'ASC' },
      }),
      m.getRepository(VendorPaymentAllocation).find({
        where: { vendorBillId: b.id },
        relations: { payment: true },
        order: { createdAt: 'ASC' },
      }),
      this.names([b.organizationId], [b.labOrderId]),
    ]);
    return {
      ...toBill(
        b,
        {
          clinicName: names.clinics.get(b.organizationId),
          orderNo: b.labOrderId ? names.orders.get(b.labOrderId) : null,
        },
        'lab',
      ),
      lines: lines.map(toBillLine),
      allocations: allocations.map((a) =>
        toAllocation(a, { paymentNo: a.payment.paymentNo }),
      ),
    };
  }

  async payments(actor: LabActorContext, q: PaymentsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [rows, total] = await this.scoped(VendorPayment, 'p', actor)
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const names = await this.names(
      rows.map((p) => p.organizationId),
      [],
    );
    const allocations = rows.length
      ? await this.dataSource.getRepository(VendorPaymentAllocation).find({
          where: { vendorPaymentId: In(rows.map((p) => p.id)) },
          relations: { bill: true },
        })
      : [];
    return PaginatedResponseDto.create(
      rows.map((p) => ({
        ...toPayment(
          p,
          { clinicName: names.clinics.get(p.organizationId) },
          'lab',
        ),
        allocations: allocations
          .filter((a) => a.vendorPaymentId === p.id)
          .map((a) => toAllocation(a, { billNo: a.bill.billNo })),
      })),
      total,
      page,
      limit,
    );
  }

  async statements(actor: LabActorContext, q: StatementsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.scoped(LabStatement, 's', actor)
      .orderBy('s.periodStart', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    const [rows, total] = await qb.getManyAndCount();
    const names = await this.names(
      rows.map((s) => s.organizationId),
      [],
    );
    return PaginatedResponseDto.create(
      rows.map((s) =>
        toStatement(
          s,
          { clinicName: names.clinics.get(s.organizationId) },
          'lab',
        ),
      ),
      total,
      page,
      limit,
    );
  }

  async statement(actor: LabActorContext, id: string) {
    const s = await this.findScoped(LabStatement, id, actor);
    if (!s)
      throw payablesError(
        'PAYABLES_STATEMENT_NOT_FOUND',
        'Statement not found',
      );
    const [lines, names] = await Promise.all([
      this.dataSource.getRepository(LabStatementLine).find({
        where: { statementId: s.id },
        order: { createdAt: 'ASC' },
      }),
      this.names([s.organizationId], []),
    ]);
    return {
      ...toStatement(
        s,
        { clinicName: names.clinics.get(s.organizationId) },
        'lab',
      ),
      lines: lines.map(toStatementLine),
    };
  }

  private async names(orgIds: string[], orderIds: Array<string | null>) {
    const orgs = [...new Set(orgIds)];
    const orders = [...new Set(orderIds.filter((x): x is string => !!x))];
    const [o, l] = await Promise.all([
      sqlRows<{ id: string; name: string }>(
        this.dataSource,
        `SELECT id, name FROM organizations WHERE id = ANY($1::uuid[])`,
        [orgs],
      ),
      sqlRows<{ id: string; order_no: string }>(
        this.dataSource,
        `SELECT id, order_no FROM lab_orders WHERE id = ANY($1::uuid[])`,
        [orders],
      ),
    ]);
    return {
      clinics: new Map(o.map((r) => [r.id, r.name])),
      orders: new Map(l.map((r) => [r.id, r.order_no])),
    };
  }
}
