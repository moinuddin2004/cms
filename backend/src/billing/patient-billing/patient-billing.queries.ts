import { EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { fromPaisa, roundRupees, toPaisa } from '../common/money';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { LedgerEntryType } from '../enums/billing.enums';
import { PatientBillingSummary } from '../mappers/billing-response.types';

export interface StatementRow {
  id: string;
  entryDate: string;
  type: LedgerEntryType;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  invoiceId: string | null;
  paymentId: string | null;
  refundId: string | null;
}

export interface Statement {
  from: string | null;
  to: string | null;
  openingBalance: number;
  rows: StatementRow[];
  closingBalance: number;
  advance: number;
}

export interface OutstandingRow {
  patientId: string;
  outstanding: number;
  advance: number;
  hasOverdue: boolean;
}

/** Patient-level money reads (6.14, 6.23). One grouped query each. */
export const PatientBillingQueries = {
  async summaries(
    manager: EntityManager,
    tenant: TenantContext,
    patientIds: string[],
    today: string,
  ): Promise<Map<string, PatientBillingSummary>> {
    if (!patientIds.length) return new Map();
    const rows: Array<Record<string, string>> = await manager.query(
      `WITH ids AS (SELECT UNNEST($3::uuid[]) AS patient_id)
       SELECT ids.patient_id,
         (SELECT COALESCE(SUM(c.net_amount), 0) FROM charges c
            WHERE c.organization_id = $1 AND c.location_id = $2 AND c.patient_id = ids.patient_id
              AND c.status = 'ACTIVE' AND c.invoice_id IS NULL) AS unbilled,
         (SELECT COUNT(*) FROM charges c
            WHERE c.organization_id = $1 AND c.location_id = $2 AND c.patient_id = ids.patient_id
              AND c.status = 'ACTIVE' AND c.source_removed_at IS NOT NULL) AS review,
         (SELECT COUNT(*) FROM charges c
            WHERE c.organization_id = $1 AND c.location_id = $2 AND c.patient_id = ids.patient_id
              AND c.status = 'ACTIVE' AND c.invoice_id IS NULL AND c.needs_pricing) AS pricing,
         (SELECT COALESCE(SUM(i.balance_due), 0) FROM invoices i
            WHERE i.organization_id = $1 AND i.location_id = $2 AND i.patient_id = ids.patient_id
              AND i.status = 'ISSUED') AS outstanding,
         (SELECT COALESCE(SUM(i.balance_due), 0) FROM invoices i
            WHERE i.organization_id = $1 AND i.location_id = $2 AND i.patient_id = ids.patient_id
              AND i.status = 'ISSUED' AND i.due_date < $4) AS overdue,
         (SELECT COALESCE(SUM(p.amount - p.allocated_amount - p.refunded_amount), 0) FROM payments p
            WHERE p.organization_id = $1 AND p.location_id = $2 AND p.patient_id = ids.patient_id) AS advance,
         (SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM ledger_entries l
            WHERE l.organization_id = $1 AND l.location_id = $2 AND l.patient_id = ids.patient_id) AS ledger
       FROM ids`,
      [tenant.organizationId, tenant.locationId, patientIds, today],
    );
    return new Map(
      rows.map((r) => {
        const unbilled = toPaisa(r.unbilled);
        const outstanding = toPaisa(r.outstanding);
        const advance = toPaisa(r.advance);
        return [
          r.patient_id,
          {
            patientId: r.patient_id,
            unbilledTotal: fromPaisa(unbilled),
            invoicedOutstanding: fromPaisa(outstanding),
            overdueAmount: roundRupees(r.overdue),
            advance: fromPaisa(advance),
            netPosition: fromPaisa(outstanding + unbilled - advance),
            ledgerBalance: roundRupees(r.ledger),
            needsReviewCount: Number(r.review),
            needsPricingCount: Number(r.pricing),
          },
        ];
      }),
    );
  },

  async summary(
    manager: EntityManager,
    tenant: TenantContext,
    patientId: string,
    today: string,
  ): Promise<PatientBillingSummary> {
    const map = await PatientBillingQueries.summaries(
      manager,
      tenant,
      [patientId],
      today,
    );
    return map.get(patientId) as PatientBillingSummary;
  },

  /** Opening, running and closing balance over a clinic-date range (6.14). */
  async statement(
    manager: EntityManager,
    tenant: TenantContext,
    patientId: string,
    from: string | null,
    to: string | null,
    today: string,
  ): Promise<Statement> {
    const [{ opening }]: Array<{ opening: string }> = from
      ? await manager.query(
          `SELECT COALESCE(SUM(debit - credit), 0) AS opening FROM ledger_entries
            WHERE organization_id = $1 AND location_id = $2 AND patient_id = $3 AND entry_date < $4`,
          [tenant.organizationId, tenant.locationId, patientId, from],
        )
      : [{ opening: '0' }];
    const qb = manager
      .getRepository(LedgerEntry)
      .createQueryBuilder('l')
      .where(
        'l.organization_id = :org AND l.location_id = :loc AND l.patient_id = :patientId',
        {
          org: tenant.organizationId,
          loc: tenant.locationId,
          patientId,
        },
      )
      .orderBy('l.entry_date', 'ASC')
      .addOrderBy('l.created_at', 'ASC');
    if (from) qb.andWhere('l.entry_date >= :from', { from });
    if (to) qb.andWhere('l.entry_date <= :to', { to });
    const entries = await qb.getMany();

    let running = toPaisa(opening);
    const rows = entries.map((e) => {
      running += toPaisa(e.debit) - toPaisa(e.credit);
      return {
        id: e.id,
        entryDate: e.entryDate,
        type: e.type,
        description: e.description,
        debit: e.debit,
        credit: e.credit,
        balance: fromPaisa(running),
        invoiceId: e.invoiceId,
        paymentId: e.paymentId,
        refundId: e.refundId,
      };
    });
    const { advance } = await PatientBillingQueries.summary(
      manager,
      tenant,
      patientId,
      today,
    );
    return {
      from,
      to,
      openingBalance: roundRupees(opening),
      rows,
      closingBalance: fromPaisa(running),
      advance,
    };
  },

  /** Queue / check-in badges (6.23). */
  async outstanding(
    manager: EntityManager,
    tenant: TenantContext,
    patientIds: string[],
    today: string,
  ): Promise<OutstandingRow[]> {
    const summaries = await PatientBillingQueries.summaries(
      manager,
      tenant,
      patientIds,
      today,
    );
    return [...summaries.values()].map((s) => ({
      patientId: s.patientId,
      outstanding: fromPaisa(
        toPaisa(s.invoicedOutstanding) + toPaisa(s.unbilledTotal),
      ),
      advance: s.advance,
      hasOverdue: toPaisa(s.overdueAmount) > 0,
    }));
  },
};
