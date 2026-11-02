import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { preTaxAllocationSql } from 'src/billing/tax/invoice-tax';
import { monthStart } from '../core/report-dates';
import type { ReportScope } from '../core/report.types';
import { emptyComponents, PnlComponents } from './profit-loss';

/** Issued lab invoices (not drafts / void). */
export const LAB_INVOICE_LIVE = `('issued', 'partially_paid', 'paid')`;
/** Approved lab bills (owed or paid). */
export const VENDOR_BILL_LIVE = `('approved', 'partially_paid', 'paid')`;

export interface Period {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

type ComponentKey = Exclude<keyof PnlComponents, 'expenses'> | 'expense';

/**
 * The P&L building blocks per month, read straight from the money tables of
 * billing v2, lab billing, lab payables, commissions, payroll and expenses.
 * One round trip; everything is summed in integer minor units.
 */
@Injectable()
export class FinanceDataService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async monthlyComponents(
    scope: ReportScope,
    period: Period,
  ): Promise<Map<string, PnlComponents>> {
    // $1 org, $2 locations, $3/$4 clinic days, $5/$6 UTC instants, $7 tz,
    // $8 first payroll month.
    const rows = await sqlRows<{
      k: ComponentKey;
      ym: string;
      cat: string | null;
      v: string;
    }>(
      this.dataSource,
      `SELECT 'clinicCollected' AS k, to_char(payment_date, 'YYYY-MM') AS ym, NULL AS cat,
              (SUM(amount) * 100)::bigint AS v
         FROM payments
        WHERE organization_id = $1 AND location_id = ANY($2) AND payment_date BETWEEN $3 AND $4
        GROUP BY 2
       UNION ALL
       SELECT 'clinicCollected', to_char(refund_date, 'YYYY-MM'), NULL, -(SUM(amount) * 100)::bigint
         FROM refunds
        WHERE organization_id = $1 AND location_id = ANY($2) AND refund_date BETWEEN $3 AND $4
        GROUP BY 2
       UNION ALL
       -- Sales tax on patient invoices is not revenue: take the tax part of
       -- each allocation (pro rata to net : tax) back out of cash collected.
       SELECT 'clinicCollected', to_char(pa.created_at AT TIME ZONE $7, 'YYYY-MM'), NULL,
              -(SUM(pa.amount - ${preTaxAllocationSql('pa', 'c')}) * 100)::bigint
         FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id
        WHERE pa.organization_id = $1 AND pa.location_id = ANY($2)
          AND pa.created_at >= $5 AND pa.created_at < $6 AND c.tax_amount > 0
        GROUP BY 2
       UNION ALL
       SELECT 'labCollected', to_char(received_on, 'YYYY-MM'), NULL, SUM(amount_minor)
         FROM lab_payments
        WHERE organization_id = $1 AND location_id = ANY($2) AND received_on BETWEEN $3 AND $4
        GROUP BY 2
       UNION ALL
       SELECT 'labCollected', to_char(refunded_at AT TIME ZONE $7, 'YYYY-MM'), NULL, -SUM(amount_minor)
         FROM lab_refunds
        WHERE organization_id = $1 AND location_id = ANY($2) AND refunded_at >= $5 AND refunded_at < $6
        GROUP BY 2
       UNION ALL
       SELECT 'clinicBilled', to_char(issue_date, 'YYYY-MM'), NULL, (SUM(total_amount - tax_amount) * 100)::bigint
         FROM invoices
        WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'ISSUED'
          AND issue_date BETWEEN $3 AND $4
        GROUP BY 2
       UNION ALL
       SELECT 'labBilled', to_char(issued_on, 'YYYY-MM'), NULL, SUM(total_minor - credited_minor)
         FROM lab_invoices
        WHERE organization_id = $1 AND location_id = ANY($2) AND status IN ${LAB_INVOICE_LIVE}
          AND issued_on BETWEEN $3 AND $4
        GROUP BY 2
       UNION ALL
       SELECT 'labCost', to_char(bill_date, 'YYYY-MM'), NULL, SUM(total_minor)
         FROM vendor_bills
        WHERE organization_id = $1 AND location_id = ANY($2) AND status IN ${VENDOR_BILL_LIVE}
          AND bill_date BETWEEN $3 AND $4
        GROUP BY 2
       UNION ALL
       SELECT 'commission', to_char(created_at AT TIME ZONE $7, 'YYYY-MM'), NULL, SUM(amount_minor)
         FROM commission_entries
        WHERE organization_id = $1 AND location_id = ANY($2) AND created_at >= $5 AND created_at < $6
        GROUP BY 2
       UNION ALL
       -- Base salary only: payroll's commission part is already counted as
       -- commission when it was earned. Rows from before the breakdown
       -- (total_minor = 0) are all salary.
       SELECT 'salaries', to_char(make_date(year, month, 1), 'YYYY-MM'), NULL,
              SUM(CASE WHEN total_minor > 0 THEN base_salary_minor
                       ELSE ROUND(salary_amount * 100)::bigint END)
         FROM payroll_records
        WHERE organization_id = $1 AND location_id = ANY($2)
          AND make_date(year, month, 1) BETWEEN $8::date AND $4::date
        GROUP BY 2
       UNION ALL
       SELECT 'expense', to_char(expense_date, 'YYYY-MM'), category::text, (SUM(amount) * 100)::bigint
         FROM expenses
        WHERE organization_id = $1 AND location_id = ANY($2) AND expense_date BETWEEN $3 AND $4
        GROUP BY 2, 3`,
      [
        scope.organizationId,
        scope.locationIds,
        period.from,
        period.to,
        period.start,
        period.end,
        scope.tz,
        monthStart(period.from),
      ],
    );

    const out = new Map<string, PnlComponents>();
    for (const r of rows) {
      const month = out.get(r.ym) ?? emptyComponents();
      const v = Number(r.v);
      if (r.k === 'expense') {
        const cat = r.cat ?? 'OTHER';
        month.expenses[cat] = (month.expenses[cat] ?? 0) + v;
      } else {
        month[r.k] += v;
      }
      out.set(r.ym, month);
    }
    return out;
  }
}
