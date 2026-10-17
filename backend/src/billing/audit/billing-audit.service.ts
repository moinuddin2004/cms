import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BillingContext } from '../common/billing-context';
import { BillingAuditLog } from '../entities/billing-audit-log.entity';
import { BillingAuditAction, BillingAuditEntity } from '../enums/billing.enums';

export interface AuditEntry {
  entityType: BillingAuditEntity;
  entityId: string;
  action: BillingAuditAction;
  before?: object | null;
  after?: object | null;
  reason?: string | null;
  amount?: number | null;
  /** Org-level entities (services, discount types) pass `null`. */
  locationScoped?: boolean;
}

/** Append-only audit writer (6.15). Always runs in the caller's transaction. */
@Injectable()
export class BillingAuditService {
  async log(
    manager: EntityManager,
    ctx: BillingContext,
    entry: AuditEntry,
  ): Promise<void> {
    await this.logMany(manager, ctx, [entry]);
  }

  async logMany(
    manager: EntityManager,
    ctx: BillingContext,
    entries: AuditEntry[],
  ): Promise<void> {
    if (!entries.length) return;
    const repo = manager.getRepository(BillingAuditLog);
    await repo.save(
      entries.map((e) =>
        repo.create({
          organizationId: ctx.tenant.organizationId,
          locationId: e.locationScoped === false ? null : ctx.tenant.locationId,
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
          before: (e.before ?? null) as Record<string, unknown> | null,
          after: (e.after ?? null) as Record<string, unknown> | null,
          reason: e.reason ?? null,
          amount: e.amount == null ? null : e.amount.toFixed(2),
          actorId: ctx.actor.userId,
          actorRole: ctx.actor.role.slice(0, 30),
        }),
      ),
      { reload: false },
    );
  }
}
