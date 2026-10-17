import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { DEFAULT_PAGE_SIZE } from '../billing.constants';
import { BillingClock } from '../common/billing-clock.service';
import { BillingLookups } from '../common/billing-lookups';
import { roundRupees } from '../common/money';
import { ActivityQueryDto } from '../dto/report.dto';
import { BillingAuditLog } from '../entities/billing-audit-log.entity';

export interface ActivityRow {
  id: string;
  at: string;
  actorId: string;
  actorName: string | null;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  amount: number | null;
  reason: string | null;
}

export interface ActivityDayTotal {
  date: string;
  actorId: string;
  actorName: string | null;
  edits: number;
  refunds: number;
  refundAmount: number;
  discounts: number;
  discountAmount: number;
  cancellations: number;
}

/** Admin billing activity: audit feed + per-user day totals (8.3). */
@Injectable()
export class BillingActivityService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
  ) {}

  async list(
    tenant: TenantContext,
    q: ActivityQueryDto,
  ): Promise<{
    feed: PaginatedResponseDto<ActivityRow>;
    dayTotals: ActivityDayTotal[];
  }> {
    const { tz, today } = await this.clock.read(tenant.locationId);
    const range = this.clock.range(tz, q.from ?? today, q.to ?? today);
    const page = q.page ?? 1;
    const limit = q.limit ?? DEFAULT_PAGE_SIZE;

    const qb = this.dataSource
      .getRepository(BillingAuditLog)
      .createQueryBuilder('a')
      .where('a.organization_id = :org', { org: tenant.organizationId })
      .andWhere('(a.location_id = :loc OR a.location_id IS NULL)', {
        loc: tenant.locationId,
      })
      .andWhere('a.created_at >= :start AND a.created_at < :end', range);
    if (q.actorId) qb.andWhere('a.actor_id = :actorId', { actorId: q.actorId });
    if (q.entityType) qb.andWhere('a.entity_type = :et', { et: q.entityType });
    if (q.action) qb.andWhere('a.action = :action', { action: q.action });
    const [rows, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totals: Array<Record<string, string>> = await this.dataSource.query(
      `SELECT (a.created_at AT TIME ZONE $4)::date::text AS day, a.actor_id,
              COUNT(*) FILTER (WHERE a.action = 'EDITED') AS edits,
              COUNT(*) FILTER (WHERE a.action = 'REFUNDED' AND a.entity_type = 'REFUND') AS refunds,
              COALESCE(SUM(a.amount) FILTER (WHERE a.action = 'REFUNDED' AND a.entity_type = 'REFUND'), 0) AS refund_amount,
              COUNT(*) FILTER (WHERE a.action = 'DISCOUNT_APPLIED') AS discounts,
              COALESCE(SUM(a.amount) FILTER (WHERE a.action = 'DISCOUNT_APPLIED'), 0) AS discount_amount,
              COUNT(*) FILTER (WHERE a.action = 'CANCELLED') AS cancellations
         FROM billing_audit_logs a
        WHERE a.organization_id = $1 AND a.location_id = $2 AND a.created_at >= $3 AND a.created_at < $5
        GROUP BY 1, 2 ORDER BY 1 DESC`,
      [tenant.organizationId, tenant.locationId, range.start, tz, range.end],
    );
    const names = await BillingLookups.userNames(this.dataSource.manager, [
      ...rows.map((r) => r.actorId),
      ...totals.map((t) => t.actor_id),
    ]);
    return {
      feed: PaginatedResponseDto.create(
        rows.map((r) => ({
          id: r.id,
          at: r.createdAt.toISOString(),
          actorId: r.actorId,
          actorName: names.get(r.actorId) ?? null,
          actorRole: r.actorRole,
          entityType: r.entityType,
          entityId: r.entityId,
          action: r.action,
          amount: r.amount == null ? null : roundRupees(r.amount),
          reason: r.reason,
        })),
        total,
        page,
        limit,
      ),
      dayTotals: totals.map((t) => ({
        date: t.day,
        actorId: t.actor_id,
        actorName: names.get(t.actor_id) ?? null,
        edits: Number(t.edits),
        refunds: Number(t.refunds),
        refundAmount: roundRupees(t.refund_amount),
        discounts: Number(t.discounts),
        discountAmount: roundRupees(t.discount_amount),
        cancellations: Number(t.cancellations),
      })),
    };
  }
}
