import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { Charge } from '../entities/charge.entity';
import { ChargeSource, ServiceKind } from '../enums/billing.enums';
import { commissionTarget, resolveCommissionRate } from './commission-math';
import {
  COMMISSIONS_FEATURE,
  CommissionBasis,
  CommissionSourceType,
} from './commission.enums';
import { CompensationPlanVersions } from './compensation-plan-versions';
import { CommissionEntry } from './entities/commission-entry.entity';

/** What caused a commission write; `id` defaults to a fresh operation id. */
export interface CommissionSource {
  type: CommissionSourceType;
  id?: string;
}

/** The commission snapshot columns of a charge. */
export type CommissionSnapshot = Pick<
  Charge,
  | 'performingAssignmentId'
  | 'commissionPlanId'
  | 'commissionRateBps'
  | 'commissionFixedPaisa'
>;

const EMPTY_SNAPSHOT: CommissionSnapshot = {
  performingAssignmentId: null,
  commissionPlanId: null,
  commissionRateBps: null,
  commissionFixedPaisa: null,
};

/** Charge sources that come from a doctor's visit and can earn commission. */
const VISIT_SOURCES = new Set([
  ChargeSource.CONSULTATION,
  ChargeSource.TREATMENT,
]);

interface ChargeCommissionRow {
  id: string;
  organization_id: string;
  location_id: string;
  assignment_id: string;
  rate_bps: number | null;
  fixed_paisa: string | null;
  basis: CommissionBasis;
  status: string;
  gross_paisa: string;
  net_paisa: string;
  allocated_paisa: string;
  already_paisa: string;
}

/**
 * Doctor commission ledger. Commission is earned on COLLECTION: whenever
 * allocations on a charge or its net change, `recordForCharges` brings
 * SUM(entries) up to the cumulative target with one signed entry. Never
 * touches charge / invoice totals — commission is an internal clinic cost.
 * Runs in the caller's money transaction, under the caller's charge locks;
 * it takes no locks of its own.
 */
@Injectable()
export class CommissionService {
  constructor(private readonly flags: FeatureFlagsService) {}

  /**
   * Snapshot for visit charges of one doctor on one clinic date: the
   * doctor's assignment here, the plan in force that day and the resolved
   * rate or fixed amount. Salary-only plans keep the rate null. Nothing is
   * set while the commissions feature is off.
   */
  async snapshot(
    manager: EntityManager,
    tenant: TenantContext,
    doctorId: string | null,
    clinicDate: string,
    charges: ReadonlyArray<
      Pick<Charge, 'source' | 'serviceId' | 'serviceKind'>
    >,
  ): Promise<CommissionSnapshot[]> {
    const none = () => charges.map(() => ({ ...EMPTY_SNAPSHOT }));
    if (
      !doctorId ||
      !(await this.flags.isFeatureEnabled(
        tenant.organizationId,
        COMMISSIONS_FEATURE,
      ))
    ) {
      return none();
    }
    const assignment = await manager
      .getRepository(EmployeeOrgLocationAssignment)
      .findOne({
        where: {
          employeeId: doctorId,
          organizationId: tenant.organizationId,
          locationId: tenant.locationId,
        },
        select: { id: true },
      });
    if (!assignment) return none();
    const plan = await CompensationPlanVersions.activeOn(
      manager,
      assignment.id,
      clinicDate,
    );
    return charges.map((c) => {
      if (!VISIT_SOURCES.has(c.source)) return { ...EMPTY_SNAPSHOT };
      const resolved = plan
        ? resolveCommissionRate(plan, {
            serviceId: c.serviceId,
            serviceKind: c.serviceKind ?? ServiceKind.OTHER,
          })
        : null;
      return {
        performingAssignmentId: assignment.id,
        commissionPlanId: plan?.id ?? null,
        commissionRateBps: resolved?.rateBps ?? null,
        commissionFixedPaisa: resolved?.fixedPaisa ?? null,
      };
    });
  }

  /**
   * The one write path of the ledger. For each charge with a snapshot:
   * target = commission on min(allocated, net); insert target − SUM(entries)
   * when it differs. Idempotent (a replay finds nothing to add), drift-free
   * across installments, and it reverses unapply / void / discounts by
   * itself. Settled entries are never touched: a reversal after settlement
   * simply lands in the next unsettled period.
   */
  async recordForCharges(
    manager: EntityManager,
    chargeIds: Iterable<string>,
    source: CommissionSource,
  ): Promise<CommissionEntry[]> {
    const ids = [...new Set(chargeIds)];
    if (!ids.length) return [];
    const rows = await this.loadTargets(manager, ids);
    const sourceId = source.id ?? randomUUID();
    const entries: Array<Partial<CommissionEntry>> = [];
    for (const r of rows) {
      const { collectedPaisa, targetPaisa } = this.targetOf(r);
      const diff = targetPaisa - Number(r.already_paisa);
      if (diff === 0) continue;
      entries.push({
        organizationId: r.organization_id,
        locationId: r.location_id,
        assignmentId: r.assignment_id,
        chargeId: r.id,
        sourceType:
          source.type === CommissionSourceType.CHARGE_ADJUST &&
          r.status === 'VOID'
            ? CommissionSourceType.VOID
            : source.type,
        sourceId,
        basePaisa: collectedPaisa,
        rateBps: r.rate_bps,
        amountPaisa: diff,
      });
    }
    if (!entries.length) return [];
    const repo = manager.getRepository(CommissionEntry);
    await repo.insert(entries);
    return entries as CommissionEntry[];
  }

  /**
   * What `recordForCharges` would write if these allocations were added
   * (collect preview). Same target function as recording; reads only.
   * Grouped per doctor (assignment) with the doctor's name.
   */
  async previewForAllocations(
    manager: EntityManager,
    lines: Array<{ chargeId: string; amountPaisa: number }>,
  ): Promise<{
    totalPaisa: number;
    byDoctor: Array<{
      assignmentId: string;
      doctorName: string;
      amountPaisa: number;
    }>;
  }> {
    const added = new Map<string, number>();
    for (const l of lines) {
      added.set(l.chargeId, (added.get(l.chargeId) ?? 0) + l.amountPaisa);
    }
    const rows = await this.loadTargets(manager, [...added.keys()]);
    const byAssignment = new Map<string, number>();
    for (const r of rows) {
      const { targetPaisa } = this.targetOf({
        ...r,
        allocated_paisa: String(
          Number(r.allocated_paisa) + (added.get(r.id) ?? 0),
        ),
      });
      const diff = targetPaisa - Number(r.already_paisa);
      byAssignment.set(
        r.assignment_id,
        (byAssignment.get(r.assignment_id) ?? 0) + diff,
      );
    }
    const ids = [...byAssignment.keys()];
    const names = ids.length
      ? await sqlRows<{ id: string; full_name: string }>(
          manager,
          `SELECT a.id, e.full_name FROM employee_org_location_assignments a
             JOIN employees e ON e.id = a.employee_id WHERE a.id = ANY($1::uuid[])`,
          [ids],
        )
      : [];
    const nameOf = new Map(names.map((n) => [n.id, n.full_name]));
    const byDoctor = ids.map((id) => ({
      assignmentId: id,
      doctorName: nameOf.get(id) ?? '',
      amountPaisa: byAssignment.get(id) ?? 0,
    }));
    return {
      totalPaisa: byDoctor.reduce((a, d) => a + d.amountPaisa, 0),
      byDoctor,
    };
  }

  private targetOf(r: ChargeCommissionRow) {
    return commissionTarget({
      allocatedPaisa: Number(r.allocated_paisa),
      netPaisa: r.status === 'VOID' ? 0 : Number(r.net_paisa),
      grossPaisa: Number(r.gross_paisa),
      basis: r.basis,
      rateBps: r.rate_bps,
      fixedPaisa: r.fixed_paisa === null ? null : Number(r.fixed_paisa),
    });
  }

  /** Charges with a snapshot + their allocations and recorded commission, in paisa. */
  private loadTargets(
    manager: EntityManager,
    ids: string[],
  ): Promise<ChargeCommissionRow[]> {
    // numeric(12,2) × 100 → bigint is exact: no float on the way to paisa.
    return sqlRows<ChargeCommissionRow>(
      manager,
      `SELECT c.id, c.organization_id, c.location_id,
              c.performing_assignment_id AS assignment_id,
              c.commission_rate_bps AS rate_bps,
              c.commission_fixed_paisa AS fixed_paisa,
              p.commission_basis AS basis, c.status,
              (c.gross_amount * 100)::bigint AS gross_paisa,
              (c.net_amount * 100)::bigint AS net_paisa,
              COALESCE((SELECT (SUM(pa.amount) * 100)::bigint
                          FROM payment_allocations pa WHERE pa.charge_id = c.id), 0) AS allocated_paisa,
              COALESCE((SELECT SUM(ce.amount_paisa)
                          FROM commission_entries ce WHERE ce.charge_id = c.id), 0) AS already_paisa
         FROM charges c
         JOIN compensation_plans p ON p.id = c.commission_plan_id
        WHERE c.id = ANY($1::uuid[])
          AND c.performing_assignment_id IS NOT NULL
          AND (c.commission_rate_bps IS NOT NULL OR c.commission_fixed_paisa IS NOT NULL)
        ORDER BY c.id`,
      [ids],
    );
  }
}
