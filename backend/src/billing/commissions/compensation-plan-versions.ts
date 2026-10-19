import {
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { addDays } from 'src/common/clock/tz.util';
import { pgError } from 'src/common/database/sql';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { billingError } from '../common/billing-errors';
import { CatalogService } from '../entities/catalog-service.entity';
import { Charge } from '../entities/charge.entity';
import {
  CommissionBasis,
  CompensationPlanType,
  MAX_RATE_BPS,
} from './commission.enums';
import { CommissionRule } from './entities/commission-rule.entity';
import { CompensationPlan } from './entities/compensation-plan.entity';
import { CommissionRuleDto } from './dto/compensation.dto';

/** A plan version as callers describe it (paisa / basis points). */
export interface PlanVersionInput {
  type: CompensationPlanType;
  baseSalaryPaisa?: number | null;
  defaultRateBps?: number | null;
  commissionBasis?: CommissionBasis;
  effectiveFrom: string;
  rules?: CommissionRuleDto[];
}

const earnsCommission = (t: CompensationPlanType) =>
  t !== CompensationPlanType.SALARY;

/**
 * Plan versioning shared by the compensation API and the employee
 * create / salary routes. Plain functions over the caller's transaction
 * (no DI), so the employees module needs no billing wiring.
 */
export const CompensationPlanVersions = {
  /** Same rule as `AuthorizationService.resolveActor`: canConsult defaults on. */
  canConsult(
    a: Pick<EmployeeOrgLocationAssignment, 'employmentRole'>,
  ): boolean {
    return a.employmentRole?.permissions?.canConsult !== false;
  },

  /** Field checks that need no database (422 on failure). */
  validateFields(input: PlanVersionInput): void {
    const salary = input.baseSalaryPaisa ?? null;
    const rate = input.defaultRateBps ?? null;
    const okInt = (v: number | null, max?: number) =>
      v === null ||
      (Number.isInteger(v) && v >= 0 && (max === undefined || v <= max));
    if (!okInt(salary) || !okInt(rate, MAX_RATE_BPS)) {
      throw billingError(
        'COMPENSATION_PLAN_INVALID',
        'Salary must be whole paisa and the rate between 0 and 10000 basis points',
      );
    }
    const needSalary = input.type !== CompensationPlanType.COMMISSION;
    const needRate = earnsCommission(input.type);
    if (needSalary !== (salary !== null) || needRate !== (rate !== null)) {
      throw billingError(
        'COMPENSATION_PLAN_INVALID',
        {
          [CompensationPlanType.SALARY]:
            'A salaried plan needs a salary and no commission rate',
          [CompensationPlanType.COMMISSION]:
            'A commission plan needs a default rate and no salary',
          [CompensationPlanType.SALARY_PLUS_COMMISSION]:
            'A salary + commission plan needs both a salary and a default rate',
        }[input.type],
      );
    }
    if (!needRate && input.rules?.length) {
      throw billingError(
        'COMPENSATION_PLAN_INVALID',
        'A salaried plan cannot have commission rules',
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
      throw billingError(
        'COMPENSATION_PLAN_INVALID',
        'Effective date must be YYYY-MM-DD',
      );
    }
  },

  /** Rule checks: one target, one amount, no duplicates, services of this org. */
  async validateRules(
    manager: EntityManager,
    organizationId: string,
    rules: CommissionRuleDto[],
  ): Promise<void> {
    const seen = new Set<string>();
    for (const r of rules) {
      const target = r.serviceId ?? r.serviceCategory ?? null;
      if (!target || (r.serviceId && r.serviceCategory)) {
        throw billingError(
          'COMMISSION_RULE_INVALID',
          'Each rule must name one service or one service category',
        );
      }
      if ((r.rateBps == null) === (r.fixedAmountPaisa == null)) {
        throw billingError(
          'COMMISSION_RULE_INVALID',
          'Each rule needs either a percentage or a fixed amount',
        );
      }
      if (seen.has(target)) {
        throw billingError(
          'COMMISSION_RULE_INVALID',
          'A service or category can have only one rule',
        );
      }
      seen.add(target);
    }
    const serviceIds = rules
      .map((r) => r.serviceId)
      .filter((x): x is string => !!x);
    if (serviceIds.length) {
      const found = await manager.getRepository(CatalogService).count({
        where: { id: In(serviceIds), organizationId },
      });
      if (found !== serviceIds.length) {
        throw billingError(
          'COMMISSION_RULE_INVALID',
          'Unknown service in rules',
        );
      }
    }
  },

  /**
   * Adds a version starting `effectiveFrom` and closes the open one the day
   * before, in the caller's transaction. A version that starts the same day
   * as the latest replaces it when no charge used it yet (a same-day fix).
   * The assignment row is locked so two edits cannot interleave.
   */
  async add(
    manager: EntityManager,
    assignment: Pick<
      EmployeeOrgLocationAssignment,
      'id' | 'organizationId' | 'employmentRole'
    >,
    input: PlanVersionInput,
    createdBy: string | null,
  ): Promise<CompensationPlan> {
    CompensationPlanVersions.validateFields(input);
    if (
      earnsCommission(input.type) &&
      !CompensationPlanVersions.canConsult(assignment)
    ) {
      throw billingError(
        'COMMISSION_ROLE_CANNOT_CONSULT',
        'Commission is only for staff whose role can consult patients',
      );
    }
    const rules = input.rules ?? [];
    await CompensationPlanVersions.validateRules(
      manager,
      assignment.organizationId,
      rules,
    );

    await manager.query(
      `SELECT id FROM employee_org_location_assignments WHERE id = $1 FOR UPDATE`,
      [assignment.id],
    );
    const plans = manager.getRepository(CompensationPlan);
    const latest = await plans.findOne({
      where: { assignmentId: assignment.id },
      order: { effectiveFrom: 'DESC' },
    });
    if (latest) {
      if (input.effectiveFrom < latest.effectiveFrom) {
        throw billingError(
          'COMPENSATION_PLAN_OVERLAP',
          `A new version must start after the current one (${latest.effectiveFrom})`,
          { currentEffectiveFrom: latest.effectiveFrom },
        );
      }
      if (input.effectiveFrom === latest.effectiveFrom) {
        const used = await manager
          .getRepository(Charge)
          .exists({ where: { commissionPlanId: latest.id } });
        if (used) {
          throw billingError(
            'COMPENSATION_PLAN_IN_USE',
            'The current version already priced charges; start the new one on a later date',
          );
        }
        await plans.delete({ id: latest.id });
      } else if (latest.effectiveTo === null) {
        await plans.update(
          { id: latest.id },
          { effectiveTo: addDays(input.effectiveFrom, -1) },
        );
      } else if (latest.effectiveTo >= input.effectiveFrom) {
        throw billingError(
          'COMPENSATION_PLAN_OVERLAP',
          `Overlaps the version ending ${latest.effectiveTo}`,
        );
      }
    }

    let saved: CompensationPlan;
    try {
      saved = await plans.save(
        plans.create({
          organizationId: assignment.organizationId,
          assignmentId: assignment.id,
          type: input.type,
          baseSalaryPaisa: input.baseSalaryPaisa ?? null,
          defaultRateBps: earnsCommission(input.type)
            ? (input.defaultRateBps ?? null)
            : null,
          commissionBasis: input.commissionBasis ?? CommissionBasis.NET,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          createdBy,
        }),
      );
    } catch (err) {
      if (pgError(err).code === '23P01') {
        throw billingError(
          'COMPENSATION_PLAN_OVERLAP',
          'Overlaps another version',
        );
      }
      throw err;
    }
    await CompensationPlanVersions.insertRules(manager, saved.id, rules);
    return saved;
  },

  async insertRules(
    manager: EntityManager,
    planId: string,
    rules: CommissionRuleDto[],
  ): Promise<void> {
    if (!rules.length) return;
    await manager.getRepository(CommissionRule).insert(
      rules.map((r) => ({
        planId,
        serviceId: r.serviceId ?? null,
        serviceCategory: r.serviceId ? null : (r.serviceCategory ?? null),
        rateBps: r.rateBps ?? null,
        fixedAmountPaisa:
          r.rateBps != null ? null : (r.fixedAmountPaisa ?? null),
      })),
    );
  },

  /** The version in force on a clinic date, with its rules. */
  activeOn(
    manager: EntityManager,
    assignmentId: string,
    date: string,
  ): Promise<CompensationPlan | null> {
    return manager.getRepository(CompensationPlan).findOne({
      where: [
        {
          assignmentId,
          effectiveFrom: LessThanOrEqual(date),
          effectiveTo: IsNull(),
        },
        {
          assignmentId,
          effectiveFrom: LessThanOrEqual(date),
          effectiveTo: MoreThanOrEqual(date),
        },
      ],
      relations: { rules: true },
    });
  },

  /** Current version for many assignments (in force on `date`). */
  async activeForMany(
    manager: EntityManager,
    assignmentIds: string[],
    date: string,
  ): Promise<Map<string, CompensationPlan>> {
    if (!assignmentIds.length) return new Map();
    const rows = await manager
      .getRepository(CompensationPlan)
      .createQueryBuilder('p')
      .where('p.assignment_id IN (:...ids)', { ids: assignmentIds })
      .andWhere('p.effective_from <= :date', { date })
      .andWhere('(p.effective_to IS NULL OR p.effective_to >= :date)', { date })
      .getMany();
    return new Map(rows.map((p) => [p.assignmentId, p]));
  },
};
