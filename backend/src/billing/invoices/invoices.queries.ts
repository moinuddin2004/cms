import { EntityManager, SelectQueryBuilder } from 'typeorm';
import type { AccessContext } from 'src/access/access-context';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { DEFAULT_PAGE_SIZE } from '../billing.constants';
import { notFound } from '../common/billing-errors';
import { BillingLookups, toPatientRef } from '../common/billing-lookups';
import { roundRupees } from '../common/money';
import { ChargeQueries } from '../charges/charges.queries';
import { BillingAuditLog } from '../entities/billing-audit-log.entity';
import { Invoice } from '../entities/invoice.entity';
import { Refund } from '../entities/refund.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  PaymentMethod,
} from '../enums/billing.enums';
import {
  InvoiceResponse,
  InvoiceRevisionLine,
} from '../mappers/billing-response.types';
import { toInvoiceResponse } from '../mappers/invoice.mapper';
import { toChargeResponse } from '../mappers/charge.mapper';
import { ListInvoicesQueryDto } from '../dto/invoice.dto';
import { InvoiceListStatus, paymentStatusSql } from './invoice-status';

export interface InvoiceStats {
  counts: Record<string, number>;
  totals: {
    invoiced: number;
    collected: number;
    outstanding: number;
    overdue: number;
    refunded: number;
  };
}

/** What the invoice list needs to apply the `billing.invoice.view` scope. */
export type InvoiceViewAccess = Pick<
  AccessContext,
  'scope' | 'applyScope' | 'employeeId'
>;

/**
 * Row scope of `billing.invoice.view` on alias `i`: `location` / `org` go
 * through applyScope; `own` = invoices carrying one of the doctor's charges.
 */
function scopeInvoices(
  qb: SelectQueryBuilder<Invoice>,
  access: InvoiceViewAccess,
): void {
  if (access.scope('billing.invoice.view') !== 'own') {
    access.applyScope(qb, 'billing.invoice.view', {
      location: 'i.location_id',
    });
    return;
  }
  if (!access.employeeId) {
    qb.andWhere('1 = 0');
    return;
  }
  qb.andWhere(
    'EXISTS (SELECT 1 FROM charges sc WHERE sc.invoice_id = i.id AND sc.doctor_id = :scopeDoctorId)',
    { scopeDoctorId: access.employeeId },
  );
}

/** Read side for invoices (CQRS-lite): list, stats, detail, revisions. */
export const InvoiceQueries = {
  async list(
    manager: EntityManager,
    tenant: TenantContext,
    q: ListInvoicesQueryDto,
    today: string,
    access: InvoiceViewAccess,
  ): Promise<PaginatedResponseDto<InvoiceResponse>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? DEFAULT_PAGE_SIZE;
    const qb = manager
      .getRepository(Invoice)
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.patient', 'p')
      .where('i.organization_id = :org AND i.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      })
      .setParameter('today', today);
    scopeInvoices(qb, access);
    if (q.paymentStatus)
      qb.andWhere(paymentStatusSql(q.paymentStatus as InvoiceListStatus));
    if (q.patientId)
      qb.andWhere('i.patient_id = :patientId', { patientId: q.patientId });
    if (q.from) qb.andWhere('i.issue_date >= :from', { from: q.from });
    if (q.to) qb.andWhere('i.issue_date <= :to', { to: q.to });
    if (q.search) {
      qb.andWhere(
        '(i.invoice_number ILIKE :s OR p.full_name ILIKE :s OR p.phone ILIKE :s OR p.patient_number ILIKE :s)',
        { s: `%${q.search.replace(/[%_]/g, '\\$&')}%` },
      );
    }
    const [rows, total] = await qb
      .orderBy('i.issuedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const names = await BillingLookups.userNames(
      manager,
      rows.map((r) => r.issuedBy),
    );
    const data = rows.map((inv) =>
      toInvoiceResponse(
        inv,
        today,
        toPatientRef(inv.patient),
        names.get(inv.issuedBy) ?? null,
      ),
    );
    return PaginatedResponseDto.create(data, total, page, limit);
  },

  async stats(
    manager: EntityManager,
    tenant: TenantContext,
    today: string,
    from?: string,
    to?: string,
  ): Promise<InvoiceStats> {
    const [row]: Array<Record<string, string>> = await manager.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'ISSUED' AND balance_due > 0 AND due_date >= $3 AND paid_amount <= 0) AS unpaid,
         COUNT(*) FILTER (WHERE status = 'ISSUED' AND balance_due > 0 AND due_date >= $3 AND paid_amount > 0) AS partially_paid,
         COUNT(*) FILTER (WHERE status = 'ISSUED' AND balance_due > 0 AND due_date < $3) AS overdue,
         COUNT(*) FILTER (WHERE status = 'ISSUED' AND balance_due <= 0) AS paid,
         COUNT(*) FILTER (WHERE refunded_amount > 0) AS refunded,
         COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'ISSUED'), 0) AS invoiced,
         COALESCE(SUM(paid_amount) FILTER (WHERE status = 'ISSUED'), 0) AS collected,
         COALESCE(SUM(balance_due) FILTER (WHERE status = 'ISSUED'), 0) AS outstanding,
         COALESCE(SUM(balance_due) FILTER (WHERE status = 'ISSUED' AND due_date < $3), 0) AS overdue_amount,
         COALESCE(SUM(refunded_amount), 0) AS refunded_amount
       FROM invoices
      WHERE organization_id = $1 AND location_id = $2
        AND ($4::date IS NULL OR issue_date >= $4) AND ($5::date IS NULL OR issue_date <= $5)`,
      [
        tenant.organizationId,
        tenant.locationId,
        today,
        from ?? null,
        to ?? null,
      ],
    );
    return {
      counts: {
        UNPAID: Number(row.unpaid),
        PARTIALLY_PAID: Number(row.partially_paid),
        OVERDUE: Number(row.overdue),
        PAID: Number(row.paid),
        REFUNDED: Number(row.refunded),
        CANCELLED: Number(row.cancelled),
      },
      totals: {
        invoiced: roundRupees(row.invoiced),
        collected: roundRupees(row.collected),
        outstanding: roundRupees(row.outstanding),
        overdue: roundRupees(row.overdue_amount),
        refunded: roundRupees(row.refunded_amount),
      },
    };
  },

  /** Invoice + charges + payments on it + refunds + revision list (7.3). */
  async detail(
    manager: EntityManager,
    tenant: TenantContext,
    id: string,
    today: string,
  ): Promise<InvoiceResponse> {
    const inv = await manager.getRepository(Invoice).findOne({
      where: {
        id,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      },
      relations: { patient: true },
    });
    if (!inv) throw notFound('Invoice');

    const charges = await ChargeQueries.base(manager, tenant)
      .andWhere('c.invoice_id = :id', { id })
      .getMany();
    const payments: Array<Record<string, string>> = await manager.query(
      `SELECT p.id, p.receipt_number, p.payment_date, p.method, p.payment_account_name, SUM(pa.amount) AS amount
         FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = $1
        GROUP BY p.id ORDER BY MIN(pa.created_at)`,
      [id],
    );
    const refunds = await manager
      .getRepository(Refund)
      .find({ where: { invoiceId: id }, order: { refundedAt: 'ASC' } });
    const revisions = await InvoiceQueries.revisionLog(manager, id);
    const names = await BillingLookups.userNames(manager, [
      inv.issuedBy,
      ...refunds.map((r) => r.refundedBy),
    ]);

    return {
      ...toInvoiceResponse(
        inv,
        today,
        toPatientRef(inv.patient),
        names.get(inv.issuedBy) ?? null,
      ),
      charges: charges.map(toChargeResponse),
      payments: payments.map((p) => ({
        paymentId: p.id,
        receiptNumber: p.receipt_number,
        paymentDate: p.payment_date,
        method: p.method as PaymentMethod,
        paymentAccountName: p.payment_account_name,
        amountOnThisInvoice: roundRupees(p.amount),
      })),
      refunds: refunds.map((r) => ({
        refundId: r.id,
        refundNumber: r.refundNumber,
        refundDate: r.refundDate,
        amount: r.amount,
        method: r.method,
        paymentAccountName: r.paymentAccountName,
        reason: r.reason,
        refundedByName: names.get(r.refundedBy) ?? null,
      })),
      revisions,
    };
  },

  async revisionLog(
    manager: EntityManager,
    invoiceId: string,
  ): Promise<InvoiceRevisionLine[]> {
    const rows = await manager.getRepository(BillingAuditLog).find({
      where: {
        entityType: BillingAuditEntity.INVOICE,
        entityId: invoiceId,
        action: BillingAuditAction.EDITED,
      },
      order: { createdAt: 'ASC' },
    });
    const names = await BillingLookups.userNames(
      manager,
      rows.map((r) => r.actorId),
    );
    return rows.map((r) => ({
      revision: Number(
        (r.after as { revision?: number } | null)?.revision ?? 0,
      ),
      editedAt: r.createdAt.toISOString(),
      editedByName: names.get(r.actorId) ?? null,
      reason: r.reason,
    }));
  },

  /**
   * Historic revision snapshot: revision n is the `before` of the edit that
   * produced n + 1, or the ISSUED snapshot for an unedited invoice.
   */
  async revisionSnapshot(
    manager: EntityManager,
    tenant: TenantContext,
    invoiceId: string,
    revision: number,
  ): Promise<Record<string, unknown>> {
    const rows = await manager.getRepository(BillingAuditLog).find({
      where: {
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
        entityType: BillingAuditEntity.INVOICE,
        entityId: invoiceId,
      },
      order: { createdAt: 'ASC' },
    });
    const edit = rows.find(
      (r) =>
        r.action === BillingAuditAction.EDITED &&
        Number((r.after as { revision?: number })?.revision) === revision + 1,
    );
    if (edit?.before) return edit.before;
    const lastEdit = [...rows]
      .reverse()
      .find((r) => r.action === BillingAuditAction.EDITED);
    if (
      lastEdit &&
      Number((lastEdit.after as { revision?: number })?.revision) ===
        revision &&
      lastEdit.after
    ) {
      return lastEdit.after;
    }
    const issued = rows.find((r) => r.action === BillingAuditAction.ISSUED);
    if (revision === 1 && issued?.after) return issued.after;
    throw notFound('Revision');
  },
};
