import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { Organization } from 'src/organizations/entities/organization.entity';
import { ConfigScope } from 'src/settings-registry/entities/config-value.entity';
import { SettingsRegistryService } from 'src/settings-registry/settings-registry.service';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { PLANS, PlanLimits } from './plans';
import {
  effectiveLimits,
  nextPaidPeriod,
  subscriptionState,
  SubscriptionState,
} from './subscription-state';
import { SUBSCRIPTION_SETTINGS } from './subscription.settings';
import {
  RecordSubscriptionPaymentDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';

export interface SubscriptionUsage {
  locations: number;
  users: number;
}

export interface SubscriptionSummary {
  organization: { id: string; name: string; isActive: boolean };
  plan: (typeof PLANS)[keyof typeof PLANS];
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  state: SubscriptionState;
  limits: PlanLimits;
  /** The org's own limit overrides (super admin), null = plan default. */
  overrides: PlanLimits;
  usage: SubscriptionUsage;
}

/** Thrown when a plan limit stops a create — the web app shows the message. */
export class PlanLimitException extends ForbiddenException {
  constructor(message: string) {
    super({ message, code: 'PLAN_LIMIT' });
  }
}

const READ_ONLY_CACHE_MS = 30_000;

/**
 * Clinic subscriptions: plan, trial/paid period, limits and the manual
 * payments a super admin records. See `subscription-state.ts` for the rules.
 */
@Injectable()
export class SubscriptionsService {
  /** orgId → read-only flag, so the guard doesn't query on every write. */
  private readonly readOnlyCache = new Map<string, { value: boolean; at: number }>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsRegistryService,
    private readonly audit: AuditService,
  ) {}

  private async org(orgId: string): Promise<Organization> {
    const org = await this.dataSource
      .getRepository(Organization)
      .findOneBy({ id: orgId });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async usage(orgId: string): Promise<SubscriptionUsage> {
    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM locations
           WHERE organization_id = $1 AND is_active = true)::int AS locations,
         (SELECT COUNT(*) FROM (
            SELECT user_id FROM organization_ownership WHERE organization_id = $1
            UNION
            SELECT user_id FROM employee_org_location_assignments
             WHERE organization_id = $1 AND user_id IS NOT NULL AND is_active = true
          ) u)::int AS users`,
      [orgId],
    );
    return { locations: row.locations, users: row.users };
  }

  async summary(orgId: string, now = new Date()): Promise<SubscriptionSummary> {
    const org = await this.org(orgId);
    return {
      organization: { id: org.id, name: org.name, isActive: org.isActive },
      plan: PLANS[org.subscriptionPlan],
      trialEndsAt: org.trialEndsAt,
      paidUntil: org.paidUntil,
      state: subscriptionState(org, now),
      limits: effectiveLimits(org),
      overrides: { maxLocations: org.maxLocations, maxUsers: org.maxUsers },
      usage: await this.usage(orgId),
    };
  }

  /** Every clinic with its subscription state — the super admin list. */
  async list(now = new Date()) {
    const orgs = await this.dataSource
      .getRepository(Organization)
      .find({ order: { name: 'ASC' } });
    return orgs.map((org) => ({
      organization: { id: org.id, name: org.name, isActive: org.isActive },
      plan: PLANS[org.subscriptionPlan],
      trialEndsAt: org.trialEndsAt,
      paidUntil: org.paidUntil,
      state: subscriptionState(org, now),
      createdAt: org.createdAt,
    }));
  }

  payments(orgId: string): Promise<SubscriptionPayment[]> {
    return this.dataSource.getRepository(SubscriptionPayment).find({
      where: { organizationId: orgId },
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });
  }

  // ── Limits ─────────────────────────────────────────────────────────

  async assertCanAddLocation(orgId: string): Promise<void> {
    const org = await this.org(orgId);
    const { maxLocations } = effectiveLimits(org);
    if (maxLocations == null) return;
    const { locations } = await this.usage(orgId);
    if (locations >= maxLocations) {
      throw new PlanLimitException(
        `Your ${PLANS[org.subscriptionPlan].name} plan allows ${maxLocations} location${maxLocations === 1 ? '' : 's'}. Upgrade your plan to add more.`,
      );
    }
  }

  async assertCanAddUser(orgId: string): Promise<void> {
    const org = await this.org(orgId);
    const { maxUsers } = effectiveLimits(org);
    if (maxUsers == null) return;
    const { users } = await this.usage(orgId);
    if (users >= maxUsers) {
      throw new PlanLimitException(
        `Your ${PLANS[org.subscriptionPlan].name} plan allows ${maxUsers} logins. Upgrade your plan to add more.`,
      );
    }
  }

  /** Whether writes are blocked for the clinic (expired subscription). */
  async isReadOnly(orgId: string): Promise<boolean> {
    const hit = this.readOnlyCache.get(orgId);
    if (hit && Date.now() - hit.at < READ_ONLY_CACHE_MS) return hit.value;
    const org = await this.dataSource
      .getRepository(Organization)
      .findOne({
        where: { id: orgId },
        select: { id: true, trialEndsAt: true, paidUntil: true },
      });
    const value = org ? subscriptionState(org, new Date()).readOnly : false;
    this.readOnlyCache.set(orgId, { value, at: Date.now() });
    return value;
  }

  // ── Super admin ────────────────────────────────────────────────────

  async recordPayment(
    orgId: string,
    dto: RecordSubscriptionPaymentDto,
    actor: ActorRef,
  ): Promise<SubscriptionPayment> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const org = await manager.getRepository(Organization).findOne({
        where: { id: orgId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!org) throw new NotFoundException('Organization not found');
      const before = this.snapshot(org);

      const period = nextPaidPeriod(org, dto.months, new Date());
      const repo = manager.getRepository(SubscriptionPayment);
      const payment = await repo.save(
        repo.create({
          organizationId: orgId,
          plan: dto.plan,
          months: dto.months,
          amount: dto.amount.toFixed(2),
          method: dto.method,
          reference: dto.reference?.trim() || null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          periodStart: period.start,
          periodEnd: period.end,
          notes: dto.notes?.trim() || null,
          recordedBy: actor.userId,
        }),
      );

      org.paidUntil = period.end;
      org.subscriptionPlan = dto.plan;
      await manager.getRepository(Organization).save(org);

      await this.audit.record(manager, actor, {
        organizationId: orgId,
        entityType: 'subscription_payment',
        entityId: payment.id,
        action: AuditAction.CREATE,
        after: {
          plan: payment.plan,
          months: payment.months,
          amount: payment.amount,
          method: payment.method,
          periodEnd: payment.periodEnd.toISOString(),
        },
        subjectId: orgId,
      });
      await this.audit.record(manager, actor, {
        organizationId: orgId,
        entityType: 'organization_subscription',
        entityId: orgId,
        action: AuditAction.UPDATE,
        before,
        after: this.snapshot(org),
        subjectId: orgId,
      });
      return payment;
    });
    this.readOnlyCache.delete(orgId);
    return saved;
  }

  async update(
    orgId: string,
    dto: UpdateSubscriptionDto,
    actor: ActorRef,
  ): Promise<SubscriptionSummary> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Organization);
      const org = await repo.findOne({
        where: { id: orgId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!org) throw new NotFoundException('Organization not found');
      const before = this.snapshot(org);
      if (dto.plan !== undefined) org.subscriptionPlan = dto.plan;
      if (dto.trialEndsAt !== undefined) {
        org.trialEndsAt = dto.trialEndsAt ? new Date(dto.trialEndsAt) : null;
      }
      if (dto.paidUntil !== undefined) {
        org.paidUntil = dto.paidUntil ? new Date(dto.paidUntil) : null;
      }
      if (dto.maxLocations !== undefined) org.maxLocations = dto.maxLocations;
      if (dto.maxUsers !== undefined) org.maxUsers = dto.maxUsers;
      await repo.save(org);
      await this.audit.record(manager, actor, {
        organizationId: orgId,
        entityType: 'organization_subscription',
        entityId: orgId,
        action: AuditAction.UPDATE,
        before,
        after: this.snapshot(org),
        subjectId: orgId,
      });
    });
    this.readOnlyCache.delete(orgId);
    return this.summary(orgId);
  }

  paymentInstructions(): Promise<string> {
    return this.settings.get<string>(
      SUBSCRIPTION_SETTINGS.paymentInstructions.key,
    );
  }

  async setPaymentInstructions(text: string, actor: ActorRef): Promise<string> {
    await this.settings.set(
      SUBSCRIPTION_SETTINGS.paymentInstructions.key,
      ConfigScope.PLATFORM,
      null,
      text,
      actor,
    );
    return this.paymentInstructions();
  }

  private snapshot(org: Organization) {
    return {
      plan: org.subscriptionPlan,
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
      paidUntil: org.paidUntil?.toISOString() ?? null,
      maxLocations: org.maxLocations,
      maxUsers: org.maxUsers,
    };
  }
}
