import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { Actor } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { BillingClock } from '../common/billing-clock.service';
import { billingError, notFound } from '../common/billing-errors';
import { CatalogService } from '../entities/catalog-service.entity';
import { ServiceKind } from '../enums/billing.enums';
import { CommissionBasis, CompensationPlanType } from './commission.enums';
import { CompensationPlanVersions } from './compensation-plan-versions';
import {
  CompensationPlanDto,
  ReplaceCommissionRulesDto,
} from './dto/compensation.dto';
import { CommissionRule } from './entities/commission-rule.entity';
import { CompensationPlan } from './entities/compensation-plan.entity';

export interface CommissionRuleView {
  id: string;
  serviceId: string | null;
  serviceName: string | null;
  serviceCategory: ServiceKind | null;
  rateBps: number | null;
  fixedAmountMinor: number | null;
}

export interface CompensationPlanView {
  id: string;
  assignmentId: string;
  type: CompensationPlanType;
  baseSalaryMinor: number | null;
  defaultRateBps: number | null;
  commissionBasis: CommissionBasis;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  rules: CommissionRuleView[];
  createdAt: Date;
}

export interface CompensationOverview {
  assignmentId: string;
  /** Clinic date at the location (default start of a new version). */
  today: string;
  /** Commission can be configured only when the role can consult. */
  canConsult: boolean;
  current: CompensationPlanView | null;
  /** Newest first. */
  versions: CompensationPlanView[];
}

/** Compensation plans per assignment (employee × location), versioned. */
@Injectable()
export class CompensationPlansService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
  ) {}

  async list(
    tenant: TenantContext,
    assignmentId: string,
  ): Promise<CompensationOverview> {
    const manager = this.dataSource.manager;
    const assignment = await this.assignment(manager, tenant, assignmentId);
    const plans = await manager.getRepository(CompensationPlan).find({
      where: { assignmentId },
      relations: { rules: true },
      order: { effectiveFrom: 'DESC' },
    });
    const { today } = await this.clock.read(tenant.locationId);
    const names = await this.serviceNames(
      manager,
      plans.flatMap((p) => p.rules),
    );
    const versions = plans.map((p) => toView(p, today, names));
    return {
      assignmentId,
      today,
      canConsult: CompensationPlanVersions.canConsult(assignment),
      current: versions.find((v) => v.isCurrent) ?? null,
      versions,
    };
  }

  /** Closes the current version the day before and adds this one (one transaction). */
  async create(
    tenant: TenantContext,
    actor: Pick<Actor, 'userId'>,
    assignmentId: string,
    dto: CompensationPlanDto,
  ): Promise<CompensationOverview> {
    const { today } = await this.clock.read(tenant.locationId);
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.assignment(manager, tenant, assignmentId);
      await CompensationPlanVersions.add(
        manager,
        assignment,
        {
          type: dto.type,
          baseSalaryMinor: dto.baseSalaryMinor ?? null,
          defaultRateBps: dto.defaultRateBps ?? null,
          commissionBasis: dto.commissionBasis,
          effectiveFrom: dto.effectiveFrom ?? today,
          rules: dto.rules,
        },
        actor.userId,
      );
    });
    return this.list(tenant, assignmentId);
  }

  /**
   * Replaces a version's service / category overrides. Charges already
   * created keep their snapshot; only later charges use the new rules.
   */
  async replaceRules(
    tenant: TenantContext,
    planId: string,
    dto: ReplaceCommissionRulesDto,
  ): Promise<CompensationOverview> {
    const { today } = await this.clock.read(tenant.locationId);
    const assignmentId = await this.dataSource.transaction(async (manager) => {
      const [locked]: Array<{ id: string }> = await manager.query(
        `SELECT id FROM compensation_plans WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [planId, tenant.organizationId],
      );
      if (!locked) throw notFound('Compensation plan');
      const plan = await manager
        .getRepository(CompensationPlan)
        .findOneByOrFail({ id: planId });
      await this.assignment(manager, tenant, plan.assignmentId);
      if (plan.type === CompensationPlanType.SALARY) {
        throw billingError(
          'COMPENSATION_PLAN_INVALID',
          'A salaried plan cannot have commission rules',
        );
      }
      if (plan.effectiveTo !== null && plan.effectiveTo < today) {
        throw billingError(
          'COMPENSATION_PLAN_CLOSED',
          'This version has ended; add a new version instead',
        );
      }
      await CompensationPlanVersions.validateRules(
        manager,
        tenant.organizationId,
        dto.rules,
      );
      await manager.getRepository(CommissionRule).delete({ planId });
      await CompensationPlanVersions.insertRules(manager, planId, dto.rules);
      return plan.assignmentId;
    });
    return this.list(tenant, assignmentId);
  }

  /** The assignment must belong to the active organization + location. */
  private async assignment(
    manager: EntityManager,
    tenant: TenantContext,
    id: string,
  ): Promise<EmployeeOrgLocationAssignment> {
    const a = await manager
      .getRepository(EmployeeOrgLocationAssignment)
      .findOne({
        where: {
          id,
          organizationId: tenant.organizationId,
          locationId: tenant.locationId,
        },
        relations: { employmentRole: true },
      });
    if (!a) throw notFound('Assignment');
    return a;
  }

  private async serviceNames(
    manager: EntityManager,
    rules: CommissionRule[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(rules.map((r) => r.serviceId).filter((x): x is string => !!x)),
    ];
    if (!ids.length) return new Map();
    const rows = await manager.getRepository(CatalogService).find({
      where: { id: In(ids) },
      select: { id: true, name: true },
    });
    return new Map(rows.map((s) => [s.id, s.name]));
  }
}

function toView(
  p: CompensationPlan,
  today: string,
  names: Map<string, string>,
): CompensationPlanView {
  return {
    id: p.id,
    assignmentId: p.assignmentId,
    type: p.type,
    baseSalaryMinor: p.baseSalaryMinor,
    defaultRateBps: p.defaultRateBps,
    commissionBasis: p.commissionBasis,
    effectiveFrom: p.effectiveFrom,
    effectiveTo: p.effectiveTo,
    isCurrent:
      p.effectiveFrom <= today &&
      (p.effectiveTo === null || p.effectiveTo >= today),
    rules: p.rules.map((r) => ({
      id: r.id,
      serviceId: r.serviceId,
      serviceName: r.serviceId ? (names.get(r.serviceId) ?? null) : null,
      serviceCategory: r.serviceCategory,
      rateBps: r.rateBps,
      fixedAmountMinor: r.fixedAmountMinor,
    })),
    createdAt: p.createdAt,
  };
}
