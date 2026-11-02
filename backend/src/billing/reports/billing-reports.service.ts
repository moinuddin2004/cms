import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PatientTreatmentPlan } from 'src/patients/entities/patient-treatment-plan.entity';
import { BillingClock } from '../common/billing-clock.service';
import { notFound } from '../common/billing-errors';
import { fromMinor, roundRupees, toMinor } from '../common/money';
import { preTaxAllocationSql } from '../tax/invoice-tax';

export interface DoctorRevenueRow {
  doctorId: string | null;
  doctorName: string;
  billed: number;
  discounts: number;
  collected: number;
}

export interface PlanBillingSummary {
  planId: string;
  estimate: number;
  billed: number;
  unbilled: number;
  notYetCharged: number;
  paid: number;
  balance: number;
}

/** Admin doctor revenue (D24, 6.21) and treatment-plan billing (D25, 6.22). */
@Injectable()
export class BillingReportsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
  ) {}

  async doctorRevenue(
    tenant: TenantContext,
    from: string,
    to: string,
  ): Promise<{
    rows: DoctorRevenueRow[];
    totals: Omit<DoctorRevenueRow, 'doctorId' | 'doctorName'>;
  }> {
    const { tz } = await this.clock.read(tenant.locationId);
    const range = this.clock.range(tz, from, to);
    const rows: Array<Record<string, string | null>> =
      await this.dataSource.query(
        `WITH billed AS (
         SELECT c.doctor_id, SUM(c.net_amount) AS billed, SUM(c.discount_amount) AS discounts
           FROM charges c JOIN invoices i ON i.id = c.invoice_id
          WHERE c.organization_id = $1 AND c.location_id = $2 AND c.status = 'ACTIVE'
            AND i.status = 'ISSUED' AND i.issue_date BETWEEN $3 AND $4
          GROUP BY c.doctor_id),
       collected AS (
         SELECT c.doctor_id, SUM(${preTaxAllocationSql('pa', 'c')}) AS collected
           FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id
          WHERE pa.organization_id = $1 AND pa.location_id = $2
            AND pa.created_at >= $5 AND pa.created_at < $6
          GROUP BY c.doctor_id),
       doctors AS (SELECT doctor_id FROM billed UNION SELECT doctor_id FROM collected)
       SELECT d.doctor_id, e.full_name,
              COALESCE(b.billed, 0) AS billed, COALESCE(b.discounts, 0) AS discounts,
              COALESCE(col.collected, 0) AS collected
         FROM doctors d
         LEFT JOIN billed b ON b.doctor_id IS NOT DISTINCT FROM d.doctor_id
         LEFT JOIN collected col ON col.doctor_id IS NOT DISTINCT FROM d.doctor_id
         LEFT JOIN employees e ON e.id = d.doctor_id
        ORDER BY billed DESC`,
        [
          tenant.organizationId,
          tenant.locationId,
          from,
          to,
          range.start,
          range.end,
        ],
      );
    const mapped = rows.map((r) => ({
      doctorId: r.doctor_id,
      doctorName: r.full_name ?? 'No doctor',
      billed: roundRupees(r.billed),
      discounts: roundRupees(r.discounts),
      collected: roundRupees(r.collected),
    }));
    const sum = (k: 'billed' | 'discounts' | 'collected') =>
      fromMinor(mapped.reduce((a, r) => a + toMinor(r[k]), 0));
    return {
      rows: mapped,
      totals: {
        billed: sum('billed'),
        discounts: sum('discounts'),
        collected: sum('collected'),
      },
    };
  }

  /** Plan charges = TREATMENT_PLAN charges of its items (V20: treatments are not linked to plan items). */
  async planSummary(
    tenant: TenantContext,
    planId: string,
  ): Promise<PlanBillingSummary> {
    const plan = await this.dataSource
      .getRepository(PatientTreatmentPlan)
      .findOne({
        where: { id: planId, organizationId: tenant.organizationId },
        select: { id: true, estimatedCost: true, finalEstimatedCost: true },
      });
    if (!plan) throw notFound('Treatment plan');
    const [row]: Array<Record<string, string>> = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(c.net_amount) FILTER (WHERE i.status = 'ISSUED'), 0) AS billed,
         COALESCE(SUM(c.tax_amount) FILTER (WHERE i.status = 'ISSUED'), 0) AS tax,
         COALESCE(SUM(c.net_amount) FILTER (WHERE c.invoice_id IS NULL), 0) AS unbilled,
         COALESCE(SUM(c.allocated_amount), 0) AS paid,
         (SELECT COALESCE(SUM(estimated_cost), 0) FROM treatment_plan_items WHERE plan_id = $3) AS items_total
       FROM charges c
       LEFT JOIN invoices i ON i.id = c.invoice_id
      WHERE c.organization_id = $1 AND c.location_id = $2 AND c.status = 'ACTIVE'
        AND c.source = 'TREATMENT_PLAN'
        AND c.source_id IN (SELECT id FROM treatment_plan_items WHERE plan_id = $3)`,
      [tenant.organizationId, tenant.locationId, planId],
    );
    const estimate = toMinor(
      plan.finalEstimatedCost ?? plan.estimatedCost ?? row.items_total,
    );
    const billed = toMinor(row.billed);
    const unbilled = toMinor(row.unbilled);
    const paid = toMinor(row.paid);
    return {
      planId,
      estimate: fromMinor(estimate),
      billed: fromMinor(billed),
      unbilled: fromMinor(unbilled),
      notYetCharged: fromMinor(Math.max(0, estimate - billed - unbilled)),
      paid: fromMinor(paid),
      // Billed is pre-tax (vs the plan estimate); what is owed includes tax.
      balance: fromMinor(billed + toMinor(row.tax) - paid),
    };
  }
}
