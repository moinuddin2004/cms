import { EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { DEFAULT_PAGE_SIZE } from '../billing.constants';
import { notFound } from '../common/billing-errors';
import { BillingLookups, toPatientRef } from '../common/billing-lookups';
import { fromPaisa, roundRupees, toPaisa } from '../common/money';
import { ListPaymentsQueryDto } from '../dto/payment.dto';
import { Payment } from '../entities/payment.entity';
import { Refund } from '../entities/refund.entity';
import {
  AllocationLine,
  PaymentResponse,
  RefundResponse,
} from '../mappers/billing-response.types';
import { toPaymentResponse, toRefundResponse } from '../mappers/payment.mapper';

export interface PaymentDetail extends PaymentResponse {
  allocations: AllocationLine[];
  refunds: RefundResponse[];
}

export interface DailyCollectionRow {
  paymentAccountId: string;
  paymentAccountName: string;
  method: string;
  paymentsTotal: number;
  paymentCount: number;
  refundsTotal: number;
  refundCount: number;
  net: number;
}

export interface DailyCollection {
  date: string;
  accounts: DailyCollectionRow[];
  totals: { payments: number; refunds: number; net: number };
}

export const PaymentQueries = {
  async list(
    manager: EntityManager,
    tenant: TenantContext,
    q: ListPaymentsQueryDto,
  ): Promise<PaginatedResponseDto<PaymentResponse>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? DEFAULT_PAGE_SIZE;
    const qb = manager
      .getRepository(Payment)
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.patient', 'pt')
      .where('p.organization_id = :org AND p.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      });
    if (q.from) qb.andWhere('p.payment_date >= :from', { from: q.from });
    if (q.to) qb.andWhere('p.payment_date <= :to', { to: q.to });
    if (q.method) qb.andWhere('p.method = :method', { method: q.method });
    if (q.paymentAccountId)
      qb.andWhere('p.payment_account_id = :acc', { acc: q.paymentAccountId });
    if (q.patientId)
      qb.andWhere('p.patient_id = :patientId', { patientId: q.patientId });
    const [rows, total] = await qb
      .orderBy('p.receivedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const names = await BillingLookups.userNames(
      manager,
      rows.map((r) => r.receivedBy),
    );
    return PaginatedResponseDto.create(
      rows.map((p) =>
        toPaymentResponse(
          p,
          toPatientRef(p.patient),
          names.get(p.receivedBy) ?? null,
        ),
      ),
      total,
      page,
      limit,
    );
  },

  async detail(
    manager: EntityManager,
    tenant: TenantContext,
    id: string,
  ): Promise<PaymentDetail> {
    const p = await manager.getRepository(Payment).findOne({
      where: {
        id,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      },
      relations: { patient: true },
    });
    if (!p) throw notFound('Payment');
    const allocations: Array<Record<string, string>> = await manager.query(
      `SELECT pa.id, pa.charge_id, c.description, pa.invoice_id, i.invoice_number,
              pa.amount, pa.reason, pa.note, pa.created_at
         FROM payment_allocations pa
         JOIN charges c ON c.id = pa.charge_id
         JOIN invoices i ON i.id = pa.invoice_id
        WHERE pa.payment_id = $1
        ORDER BY pa.created_at`,
      [id],
    );
    const refunds = await manager
      .getRepository(Refund)
      .createQueryBuilder('r')
      .innerJoin('r.sources', 's', 's.payment_id = :id', { id })
      .getMany();
    const patient = toPatientRef(p.patient);
    const names = await BillingLookups.userNames(manager, [
      p.receivedBy,
      ...refunds.map((r) => r.refundedBy),
    ]);
    return {
      ...toPaymentResponse(p, patient, names.get(p.receivedBy) ?? null),
      allocations: allocations.map((a) => ({
        id: a.id,
        chargeId: a.charge_id,
        chargeDescription: a.description,
        invoiceId: a.invoice_id,
        invoiceNumber: a.invoice_number,
        amount: roundRupees(a.amount),
        reason: a.reason,
        note: a.note,
        createdAt: new Date(a.created_at).toISOString(),
      })),
      refunds: refunds.map((r) =>
        toRefundResponse(r, patient, names.get(r.refundedBy) ?? null, null),
      ),
    };
  },

  /** Totals per payment account for one clinic date, refunds subtracted (7.4). */
  async dailyCollection(
    manager: EntityManager,
    tenant: TenantContext,
    date: string,
  ): Promise<DailyCollection> {
    const rows: Array<Record<string, string>> = await manager.query(
      `SELECT a.id, a.name, a.method,
              COALESCE(p.total, 0) AS payments, COALESCE(p.cnt, 0) AS payment_count,
              COALESCE(r.total, 0) AS refunds, COALESCE(r.cnt, 0) AS refund_count
         FROM payment_accounts a
         LEFT JOIN (SELECT payment_account_id, SUM(amount) total, COUNT(*) cnt FROM payments
                     WHERE organization_id = $1 AND location_id = $2 AND payment_date = $3
                     GROUP BY payment_account_id) p ON p.payment_account_id = a.id
         LEFT JOIN (SELECT payment_account_id, SUM(amount) total, COUNT(*) cnt FROM refunds
                     WHERE organization_id = $1 AND location_id = $2 AND refund_date = $3
                     GROUP BY payment_account_id) r ON r.payment_account_id = a.id
        WHERE a.organization_id = $1 AND a.location_id = $2
          AND (a.is_active OR p.cnt > 0 OR r.cnt > 0)
        ORDER BY a.sort_order, a.name`,
      [tenant.organizationId, tenant.locationId, date],
    );
    const accounts = rows.map((r) => ({
      paymentAccountId: r.id,
      paymentAccountName: r.name,
      method: r.method,
      paymentsTotal: roundRupees(r.payments),
      paymentCount: Number(r.payment_count),
      refundsTotal: roundRupees(r.refunds),
      refundCount: Number(r.refund_count),
      net: fromPaisa(toPaisa(r.payments) - toPaisa(r.refunds)),
    }));
    const sum = (k: 'paymentsTotal' | 'refundsTotal') =>
      accounts.reduce((a, r) => a + toPaisa(r[k]), 0);
    return {
      date,
      accounts,
      totals: {
        payments: fromPaisa(sum('paymentsTotal')),
        refunds: fromPaisa(sum('refundsTotal')),
        net: fromPaisa(sum('paymentsTotal') - sum('refundsTotal')),
      },
    };
  },
};
