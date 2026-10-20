import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { resolveCommissionRate } from 'src/billing/commissions/commission-math';
import {
  COMMISSIONS_FEATURE,
  CommissionBasis,
  CommissionSourceType,
} from 'src/billing/commissions/commission.enums';
import { CompensationPlanVersions } from 'src/billing/commissions/compensation-plan-versions';
import {
  CommissionEntry,
  CommissionEntryRow,
} from 'src/billing/commissions/entities/commission-entry.entity';
import { CompensationPlan } from 'src/billing/commissions/entities/compensation-plan.entity';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import { sqlRows } from 'src/common/database/sql';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { LabInvoiceLine } from 'src/lab-billing/entities/lab-invoice.entity';
import { LabInvoiceLineKind } from 'src/lab-billing/enums/lab-billing.enums';
import { LabCaseCostService } from 'src/lab-payables/services/payables-reports.service';
import { labLineCommissionTarget } from './lab-commission-math';

interface LineRow {
  id: string;
  organization_id: string;
  location_id: string;
  assignment_id: string;
  doctor_id: string | null;
  order_id: string | null;
  patient_id: string;
  rate_bps: number | null;
  fixed_paisa: string | null;
  basis: CommissionBasis;
  line_kind: LabInvoiceLineKind;
  lab_order_item_id: string | null;
  charge_item_id: string | null;
  charge_amount_paisa: string | null;
  gross_paisa: string;
  line_total_paisa: string;
  tax_paisa: string;
  total_paisa: string;
  credited_paisa: string;
  status: string;
  allocated_paisa: string;
  already_paisa: string;
}

type PlanPick = {
  assignmentId: string;
  plan: CompensationPlan | null;
} | null;

/** Commission written for one doctor by one operation (signed). */
export interface LabCommissionDelta {
  doctorId: string | null;
  orderId: string | null;
  patientId: string;
  locationId: string;
  amountPaisa: number;
}

/**
 * Doctor commission on lab work (lab ERD §6c / §10 "Patient payment",
 * "Payment reversal"), on billing v2's append-only `commission_entries`
 * (`lab_invoice_line_id` instead of `charge_id`), so settlements and payroll
 * pick lab commission up unchanged. Same cumulative-target pattern as
 * billing v2's `CommissionService`: each money operation inserts
 * `target − already recorded` per line. Runs in the caller's transaction,
 * under its invoice locks.
 */
@Injectable()
export class LabCommissionService {
  constructor(
    private readonly flags: FeatureFlagsService,
    private readonly labCost: LabCaseCostService,
  ) {}

  /**
   * At issue: the doctor's assignment at the invoice's location, the plan in
   * force on the issue date and the rate for the line's service. Nothing is
   * set while the commissions feature is off (the line then never earns).
   */
  async snapshot(
    m: EntityManager,
    org: string,
    locationId: string,
    invoiceId: string,
    issuedOn: string,
  ): Promise<void> {
    if (!(await this.flags.isFeatureEnabled(org, COMMISSIONS_FEATURE))) return;
    const lines = await sqlRows<{
      id: string;
      doctor_id: string | null;
      service_id: string | null;
      kind: ServiceKind | null;
    }>(
      m,
      `SELECT l.id, l.doctor_id, l.clinic_treatment_id AS service_id, s.kind
         FROM lab_invoice_lines l
         LEFT JOIN services s ON s.id = l.clinic_treatment_id
        WHERE l.invoice_id = $1 AND NOT l.is_void AND l.doctor_id IS NOT NULL
        ORDER BY l.line_no`,
      [invoiceId],
    );
    const plans = new Map<string, PlanPick>();
    for (const line of lines) {
      const doctor = line.doctor_id!;
      if (!plans.has(doctor))
        plans.set(
          doctor,
          await this.planFor(m, org, locationId, doctor, issuedOn),
        );
      const found = plans.get(doctor);
      if (!found) continue;
      const resolved = found.plan
        ? resolveCommissionRate(found.plan, {
            serviceId: line.service_id,
            // Lab work is a procedure unless the mapped service says otherwise.
            serviceKind: line.kind ?? ServiceKind.PROCEDURE,
          })
        : null;
      await m.getRepository(LabInvoiceLine).update(line.id, {
        performingAssignmentId: found.assignmentId,
        commissionPlanId: found.plan?.id ?? null,
        commissionRateBps: resolved?.rateBps ?? null,
        commissionFixedPaisa: resolved?.fixedPaisa ?? null,
      });
    }
  }

  /**
   * Brings every snapshotted line of these invoices up to its target.
   * Idempotent: a replay finds nothing to add. Returns what was written,
   * summed per doctor, for the commission journal.
   */
  async recordForInvoices(
    m: EntityManager,
    invoiceIds: Iterable<string>,
    source: { type: CommissionSourceType; id?: string },
  ): Promise<LabCommissionDelta[]> {
    const ids = [...new Set(invoiceIds)];
    if (!ids.length) return [];
    const rows = await this.load(m, ids);
    if (!rows.length) return [];
    const costs = await this.labCost.forItems(
      m,
      rows.flatMap((r) => (r.lab_order_item_id ? [r.lab_order_item_id] : [])),
    );
    const sourceId = source.id ?? randomUUID();
    const entries: CommissionEntryRow[] = [];
    const deltas = new Map<string, LabCommissionDelta>();
    for (const r of rows) {
      const { collectedPaisa, targetPaisa } = labLineCommissionTarget({
        lineTotalPaisa: Number(r.line_total_paisa),
        taxPaisa: Number(r.tax_paisa),
        grossPaisa: Number(r.gross_paisa),
        invoiceTotalPaisa: Number(r.total_paisa),
        creditedPaisa: Number(r.credited_paisa),
        allocatedPaisa: Number(r.allocated_paisa),
        invoiceVoid: r.status === 'void',
        labCostPaisa: this.costOf(r, costs),
        basis: r.basis,
        rateBps: r.rate_bps,
        fixedPaisa: r.fixed_paisa === null ? null : Number(r.fixed_paisa),
      });
      const diff = targetPaisa - Number(r.already_paisa);
      if (diff === 0) continue;
      entries.push({
        organizationId: r.organization_id,
        locationId: r.location_id,
        assignmentId: r.assignment_id,
        chargeId: null,
        labInvoiceLineId: r.id,
        sourceType: source.type,
        sourceId,
        basePaisa: collectedPaisa,
        rateBps: r.rate_bps,
        amountPaisa: diff,
      });
      const key = `${r.doctor_id}|${r.order_id}|${r.patient_id}`;
      const d = deltas.get(key) ?? {
        doctorId: r.doctor_id,
        orderId: r.order_id,
        patientId: r.patient_id,
        locationId: r.location_id,
        amountPaisa: 0,
      };
      d.amountPaisa += diff;
      deltas.set(key, d);
    }
    if (entries.length) await m.getRepository(CommissionEntry).insert(entries);
    return [...deltas.values()].filter((d) => d.amountPaisa !== 0);
  }

  /**
   * The lab's share of the line (ERD `net_of_lab_cost`): an item's cost
   * (approved vendor bill lines, else its frozen snapshot); an order-level
   * charge passed on to the patient costs its amount; an item-level charge
   * is already inside the item's cost; manual lines cost nothing.
   */
  private costOf(r: LineRow, costs: Map<string, number>): number {
    if (r.line_kind === LabInvoiceLineKind.LAB_ITEM && r.lab_order_item_id)
      return costs.get(r.lab_order_item_id) ?? 0;
    if (r.line_kind === LabInvoiceLineKind.LAB_CHARGE && !r.charge_item_id)
      return Number(r.charge_amount_paisa ?? 0);
    return 0;
  }

  private async planFor(
    m: EntityManager,
    org: string,
    locationId: string,
    doctorId: string,
    date: string,
  ): Promise<PlanPick> {
    const assignment = await m
      .getRepository(EmployeeOrgLocationAssignment)
      .findOne({
        where: { employeeId: doctorId, organizationId: org, locationId },
        select: { id: true },
      });
    if (!assignment) return null;
    return {
      assignmentId: assignment.id,
      plan: await CompensationPlanVersions.activeOn(m, assignment.id, date),
    };
  }

  private load(m: EntityManager, invoiceIds: string[]): Promise<LineRow[]> {
    return sqlRows<LineRow>(
      m,
      `SELECT l.id, l.organization_id, i.location_id,
              l.performing_assignment_id AS assignment_id, l.doctor_id,
              i.order_id, i.patient_id,
              l.commission_rate_bps AS rate_bps,
              l.commission_fixed_paisa AS fixed_paisa,
              p.commission_basis AS basis, l.line_kind, l.lab_order_item_id,
              cr.item_id AS charge_item_id, cr.amount_paisa AS charge_amount_paisa,
              l.quantity::bigint * l.unit_price_paisa AS gross_paisa,
              l.line_total_paisa, l.tax_paisa,
              i.total_paisa, i.credited_paisa, i.status,
              COALESCE((SELECT SUM(a.amount_paisa) FROM lab_payment_allocations a
                         WHERE a.invoice_id = i.id AND a.reversed_at IS NULL), 0) AS allocated_paisa,
              COALESCE((SELECT SUM(ce.amount_paisa) FROM commission_entries ce
                         WHERE ce.lab_invoice_line_id = l.id), 0) AS already_paisa
         FROM lab_invoice_lines l
         JOIN lab_invoices i ON i.id = l.invoice_id
         JOIN compensation_plans p ON p.id = l.commission_plan_id
         LEFT JOIN order_charge_requests cr ON cr.id = l.order_charge_request_id
        WHERE l.invoice_id = ANY($1::uuid[])
          AND l.performing_assignment_id IS NOT NULL
          AND (l.commission_rate_bps IS NOT NULL OR l.commission_fixed_paisa IS NOT NULL)
        ORDER BY l.id`,
      [invoiceIds],
    );
  }
}
