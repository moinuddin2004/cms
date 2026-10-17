import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingAuditService } from '../audit/billing-audit.service';
import { BillingClock } from '../common/billing-clock.service';
import { BillingContext } from '../common/billing-context';
import { billingError, notFound } from '../common/billing-errors';
import { BillingLookups } from '../common/billing-lookups';
import { toPaisa } from '../common/money';
import { CreateCashCloseDto } from '../dto/report.dto';
import { CashClose, CashCloseLine } from '../entities/cash-close.entity';
import { BillingAuditAction, BillingAuditEntity } from '../enums/billing.enums';
import { BillingSettingsService } from '../settings/billing-settings.service';
import {
  AccountWindowTotals,
  calculateCashClose,
  CashCloseCalc,
} from './cash-close-calculator';

export interface CashClosePreview extends CashCloseCalc {
  periodStart: string | null;
  periodEnd: string;
}

export interface CashCloseView {
  id: string;
  periodStart: string;
  periodEnd: string;
  businessDate: string;
  totalExpected: number;
  totalCounted: number;
  totalVariance: number;
  note: string | null;
  closedByName: string | null;
  flagged: boolean;
  createdAt: string;
  lines?: CashCloseLine[];
}

/** Counter close per payment account (D23, 6.20). Immutable; never blocks payments. */
@Injectable()
export class CashCloseService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
    private readonly settings: BillingSettingsService,
    private readonly audit: BillingAuditService,
  ) {}

  async preview(tenant: TenantContext): Promise<CashClosePreview> {
    const manager = this.dataSource.manager;
    const { now } = await this.clock.read(tenant.locationId);
    const start = await this.lastPeriodEnd(manager, tenant);
    const totals = await this.windowTotals(manager, tenant, start, now);
    return {
      ...calculateCashClose(totals, new Map()),
      periodStart: start?.toISOString() ?? null,
      periodEnd: now.toISOString(),
    };
  }

  async create(
    ctx: BillingContext,
    dto: CreateCashCloseDto,
  ): Promise<CashCloseView> {
    const id = await this.dataSource.transaction(async (manager) => {
      // Two closes of one location can never overlap (6.20 step 1).
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `cash-close:${ctx.tenant.locationId}`,
      ]);
      const time = await this.clock.read(ctx.tenant.locationId);
      const periodEnd = new Date(dto.periodEnd);
      const start = await this.lastPeriodEnd(manager, ctx.tenant);
      if (
        Number.isNaN(periodEnd.getTime()) ||
        periodEnd > time.now ||
        (start && periodEnd <= start)
      ) {
        throw billingError(
          'BILLING_CASH_CLOSE_PERIOD_INVALID',
          'This counter was already closed — open a fresh preview',
        );
      }

      const totals = await this.windowTotals(
        manager,
        ctx.tenant,
        start,
        periodEnd,
      );
      const calc = calculateCashClose(
        totals,
        new Map(dto.lines.map((l) => [l.paymentAccountId, l.counted])),
      );
      if (calc.missingCounts.length) {
        throw billingError(
          'BILLING_CASH_CLOSE_COUNT_REQUIRED',
          `Enter the counted amount for ${calc.missingCounts.join(', ')}`,
        );
      }
      if (calc.hasVariance && !dto.note?.trim()) {
        throw billingError(
          'BILLING_CASH_CLOSE_NOTE_REQUIRED',
          'Explain the difference in a note',
        );
      }

      const close = await manager.getRepository(CashClose).save(
        manager.getRepository(CashClose).create({
          organizationId: ctx.tenant.organizationId,
          locationId: ctx.tenant.locationId,
          periodStart:
            start ??
            (await this.firstTransactionAt(manager, ctx.tenant)) ??
            periodEnd,
          periodEnd,
          businessDate: this.clock.dateOf(time.tz, periodEnd),
          totalExpected: calc.totalExpected,
          totalCounted: calc.totalCounted,
          totalVariance: calc.totalVariance,
          note: dto.note?.trim() || null,
          closedBy: ctx.actor.userId,
        }),
      );
      await manager.getRepository(CashCloseLine).insert(
        calc.lines.map((l) => ({
          cashCloseId: close.id,
          paymentAccountId: l.paymentAccountId,
          paymentAccountName: l.paymentAccountName,
          paymentsTotal: l.paymentsTotal,
          refundsTotal: l.refundsTotal,
          paymentCount: l.paymentCount,
          refundCount: l.refundCount,
          expected: l.expected,
          counted: l.counted,
          variance: l.variance,
        })),
      );
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.CASH_CLOSE,
        entityId: close.id,
        action: BillingAuditAction.CLOSED,
        after: { ...close, lines: calc.lines },
        reason: close.note,
        amount: calc.totalVariance,
      });
      return close.id;
    });
    return this.detail(ctx.tenant, id);
  }

  async history(
    tenant: TenantContext,
    from?: string,
    to?: string,
  ): Promise<CashCloseView[]> {
    const qb = this.dataSource
      .getRepository(CashClose)
      .createQueryBuilder('cc')
      .where('cc.organization_id = :org AND cc.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      })
      .orderBy('cc.period_end', 'DESC')
      .take(200);
    if (from) qb.andWhere('cc.business_date >= :from', { from });
    if (to) qb.andWhere('cc.business_date <= :to', { to });
    return this.views(tenant, await qb.getMany());
  }

  async detail(tenant: TenantContext, id: string): Promise<CashCloseView> {
    const close = await this.dataSource.getRepository(CashClose).findOne({
      where: {
        id,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      },
      relations: { lines: true },
    });
    if (!close) throw notFound('Cash close');
    const [view] = await this.views(tenant, [close]);
    return { ...view, lines: close.lines };
  }

  private async views(
    tenant: TenantContext,
    rows: CashClose[],
  ): Promise<CashCloseView[]> {
    const settings = await this.settings.getOrCreate(
      this.dataSource.manager,
      tenant,
    );
    const alert = toPaisa(settings.cashVarianceAlertAmount);
    const names = await BillingLookups.userNames(
      this.dataSource.manager,
      rows.map((r) => r.closedBy),
    );
    return rows.map((c) => ({
      id: c.id,
      periodStart: c.periodStart.toISOString(),
      periodEnd: c.periodEnd.toISOString(),
      businessDate: c.businessDate,
      totalExpected: c.totalExpected,
      totalCounted: c.totalCounted,
      totalVariance: c.totalVariance,
      note: c.note,
      closedByName: names.get(c.closedBy) ?? null,
      flagged: Math.abs(toPaisa(c.totalVariance)) > alert,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  private async lastPeriodEnd(
    manager: EntityManager,
    tenant: TenantContext,
  ): Promise<Date | null> {
    const last = await manager.getRepository(CashClose).findOne({
      where: {
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      },
      order: { periodEnd: 'DESC' },
      select: { id: true, periodEnd: true },
    });
    return last?.periodEnd ?? null;
  }

  private async firstTransactionAt(
    manager: EntityManager,
    tenant: TenantContext,
  ): Promise<Date | null> {
    const [row]: Array<{ first: Date | null }> = await manager.query(
      `SELECT LEAST(
         (SELECT MIN(received_at) FROM payments WHERE organization_id = $1 AND location_id = $2),
         (SELECT MIN(refunded_at) FROM refunds WHERE organization_id = $1 AND location_id = $2)) AS first`,
      [tenant.organizationId, tenant.locationId],
    );
    return row?.first ? new Date(row.first) : null;
  }

  /** Per account: payments by receivedAt and refunds by refundedAt in (start, end]. */
  private async windowTotals(
    manager: EntityManager,
    tenant: TenantContext,
    start: Date | null,
    end: Date,
  ): Promise<AccountWindowTotals[]> {
    const rows: Array<Record<string, string | boolean>> = await manager.query(
      `SELECT a.id, a.name, a.counted_in_cash_close,
              COALESCE(p.total, 0) AS payments, COALESCE(p.cnt, 0) AS payment_count,
              COALESCE(r.total, 0) AS refunds, COALESCE(r.cnt, 0) AS refund_count
         FROM payment_accounts a
         LEFT JOIN (SELECT payment_account_id, SUM(amount) total, COUNT(*) cnt FROM payments
                     WHERE organization_id = $1 AND location_id = $2
                       AND ($3::timestamptz IS NULL OR received_at > $3) AND received_at <= $4
                     GROUP BY payment_account_id) p ON p.payment_account_id = a.id
         LEFT JOIN (SELECT payment_account_id, SUM(amount) total, COUNT(*) cnt FROM refunds
                     WHERE organization_id = $1 AND location_id = $2
                       AND ($3::timestamptz IS NULL OR refunded_at > $3) AND refunded_at <= $4
                     GROUP BY payment_account_id) r ON r.payment_account_id = a.id
        WHERE a.organization_id = $1 AND a.location_id = $2
          AND (a.is_active OR p.cnt > 0 OR r.cnt > 0)
        ORDER BY a.sort_order, a.name`,
      [tenant.organizationId, tenant.locationId, start, end],
    );
    return rows.map((r) => ({
      paymentAccountId: String(r.id),
      paymentAccountName: String(r.name),
      countedInCashClose: Boolean(r.counted_in_cash_close),
      paymentsTotal: Number(r.payments),
      paymentCount: Number(r.payment_count),
      refundsTotal: Number(r.refunds),
      refundCount: Number(r.refund_count),
    }));
  }
}
