import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { TreatmentPlanItem } from 'src/patients/entities/treatment-plan-item.entity';
import { PatientTreatmentPlan } from 'src/patients/entities/patient-treatment-plan.entity';
import { BillingAuditService } from '../audit/billing-audit.service';
import { ChargePricingService } from '../catalog/charge-pricing.service';
import { BillingClock } from '../common/billing-clock.service';
import { BillingContext } from '../common/billing-context';
import { billingError, notFound } from '../common/billing-errors';
import { BillingLocks } from '../common/billing-locks';
import { BillingLookups } from '../common/billing-lookups';
import { CreateManualChargeDto, UpdateChargeDto } from '../dto/charge.dto';
import { ApplyDiscountDto, BulkDiscountDto } from '../dto/discount.dto';
import { Charge } from '../entities/charge.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  ChargeStatus,
} from '../enums/billing.enums';
import { DiscountApplier } from '../discounts/discount-applier.service';
import { ChargeResponse } from '../mappers/billing-response.types';
import {
  chargeSnapshot,
  clearDiscount,
  recalcCharge,
  voidCharge,
} from './charge-math';
import { ChargeListState, ChargeQueries } from './charges.queries';
import { ChargeDraftFactory } from './sources/charge-draft.factory';

export interface ReadyToBillRow {
  patientId: string;
  patientName: string;
  phone: string | null;
  mrn: string | null;
  chargeCount: number;
  unbilledTotal: number;
  needsPricing: boolean;
  lastChargeAt: string;
}

/**
 * Unbilled charges: add, edit, discount, void (7.2). Billed charges change
 * only through an invoice edit (D9/D10) → BILLING_CHARGE_ALREADY_BILLED.
 */
@Injectable()
export class ChargesService {
  private readonly factory = new ChargeDraftFactory();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
    private readonly pricing: ChargePricingService,
    private readonly discounts: DiscountApplier,
    private readonly audit: BillingAuditService,
  ) {}

  async list(
    tenant: TenantContext,
    patientId: string,
    state: ChargeListState,
  ): Promise<ChargeResponse[]> {
    await BillingLookups.patient(this.dataSource.manager, tenant, patientId);
    return ChargeQueries.forPatient(
      this.dataSource.manager,
      tenant,
      patientId,
      state,
    );
  }

  async addManual(
    ctx: BillingContext,
    patientId: string,
    dto: CreateManualChargeDto,
  ): Promise<ChargeResponse> {
    return this.dataSource.transaction(async (manager) => {
      await BillingLookups.patient(manager, ctx.tenant, patientId);
      if (dto.doctorId)
        await BillingLookups.assertDoctor(manager, ctx.tenant, dto.doctorId);
      const { today } = await this.clock.read(ctx.tenant.locationId);
      const price = dto.serviceId
        ? await this.pricing.resolve(
            manager,
            ctx.tenant,
            dto.serviceId,
            dto.doctorId,
          )
        : null;
      if (!price && dto.unitPrice == null) {
        throw billingError(
          'BILLING_CHARGE_INVALID',
          'Enter a price for this charge',
        );
      }
      const draft = this.factory.manual(
        {
          ...ctx.tenant,
          patientId,
          doctorId: dto.doctorId ?? null,
          chargeDate: dto.chargeDate ?? today,
          createdBy: ctx.actor.userId,
          description: dto.description ?? '',
          quantity: dto.quantity ?? 1,
          unitPrice: dto.unitPrice ?? 0,
        },
        price,
      );
      const charge = manager.getRepository(Charge).create(draft);
      if (price && dto.unitPrice != null && dto.unitPrice !== price.unitPrice) {
        this.assertCanSetPrice(ctx, charge);
        charge.unitPrice = dto.unitPrice;
        recalcCharge(charge);
      }
      await manager.save(charge);
      await this.auditCharge(
        manager,
        ctx,
        charge,
        BillingAuditAction.CREATED,
        null,
      );
      return this.view(manager, ctx.tenant, charge.id);
    });
  }

  async update(
    ctx: BillingContext,
    chargeId: string,
    dto: UpdateChargeDto,
  ): Promise<ChargeResponse> {
    return this.mutateUnbilled(
      ctx,
      chargeId,
      BillingAuditAction.UPDATED,
      async (manager, charge) => {
        if (dto.unitPrice !== undefined && dto.unitPrice !== charge.unitPrice) {
          this.assertCanSetPrice(ctx, charge);
          charge.unitPrice = dto.unitPrice;
          charge.needsPricing = false;
        }
        if (dto.quantity !== undefined) charge.quantity = dto.quantity;
        if (dto.description !== undefined) {
          if (charge.serviceId) {
            throw billingError(
              'BILLING_CHARGE_INVALID',
              'Only "Other" charges can be renamed',
            );
          }
          charge.description = dto.description;
        }
        if (dto.doctorId !== undefined) {
          if (dto.doctorId)
            await BillingLookups.assertDoctor(
              manager,
              ctx.tenant,
              dto.doctorId,
            );
          charge.doctorId = dto.doctorId;
        }
        recalcCharge(charge);
      },
    );
  }

  async setDiscount(
    ctx: BillingContext,
    chargeId: string,
    dto: ApplyDiscountDto,
  ): Promise<ChargeResponse> {
    return this.mutateUnbilled(
      ctx,
      chargeId,
      BillingAuditAction.DISCOUNT_APPLIED,
      async (manager, charge) => {
        const { today } = await this.clock.read(ctx.tenant.locationId);
        const discount = await this.discounts.resolve(manager, ctx, dto, today);
        await this.discounts.applyOne(manager, ctx, charge, discount);
      },
    );
  }

  async removeDiscount(
    ctx: BillingContext,
    chargeId: string,
  ): Promise<ChargeResponse> {
    return this.mutateUnbilled(
      ctx,
      chargeId,
      BillingAuditAction.DISCOUNT_REMOVED,
      (_m, charge) => {
        clearDiscount(charge);
      },
    );
  }

  /** One type on many unbilled charges; non-matching ones are skipped (6.3). */
  async bulkDiscount(
    ctx: BillingContext,
    dto: BulkDiscountDto,
  ): Promise<{
    charges: ChargeResponse[];
    skipped: Array<{ chargeId: string; description: string }>;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const { charges } = await BillingLocks.chargesWithInvoices(
        manager,
        ctx.tenant,
        dto.chargeIds,
      );
      charges.forEach((c) => this.assertUnbilled(c));
      const before = new Map(charges.map((c) => [c.id, chargeSnapshot(c)]));
      const { today } = await this.clock.read(ctx.tenant.locationId);
      const discount = await this.discounts.resolve(manager, ctx, dto, today);
      const { applied, skipped } = await this.discounts.applyMany(
        manager,
        ctx,
        charges,
        discount,
      );
      await manager.save(applied);
      await this.audit.logMany(
        manager,
        ctx,
        applied.map((c) => ({
          entityType: BillingAuditEntity.CHARGE,
          entityId: c.id,
          action: BillingAuditAction.DISCOUNT_APPLIED,
          before: before.get(c.id),
          after: chargeSnapshot(c),
          amount: c.discountAmount,
          reason: discount.note,
        })),
      );
      return {
        charges: await ChargeQueries.byIds(
          manager,
          ctx.tenant,
          applied.map((c) => c.id),
        ),
        skipped,
      };
    });
  }

  async void(
    ctx: BillingContext,
    chargeId: string,
    reason: string,
  ): Promise<ChargeResponse> {
    return this.mutateUnbilled(
      ctx,
      chargeId,
      BillingAuditAction.VOIDED,
      (_m, charge, time) => {
        voidCharge(charge, reason, ctx.actor.userId, time);
      },
      reason,
    );
  }

  /** One unbilled charge per plan item; the unique source index blocks double billing (6.4). */
  async fromTreatmentPlan(
    ctx: BillingContext,
    patientId: string,
    planId: string,
    itemIds: string[],
  ): Promise<ChargeResponse[]> {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.getRepository(PatientTreatmentPlan).findOne({
        where: {
          id: planId,
          patientId,
          organizationId: ctx.tenant.organizationId,
        },
        select: { id: true, dentistId: true },
      });
      if (!plan) throw notFound('Treatment plan');
      const items = await manager.getRepository(TreatmentPlanItem).find({
        where: { id: In(itemIds), planId },
      });
      if (items.length !== new Set(itemIds).size) throw notFound('Plan item');
      const { today } = await this.clock.read(ctx.tenant.locationId);

      const drafts = items.map((item) =>
        this.factory.fromPlanItem(
          {
            ...ctx.tenant,
            patientId,
            doctorId: item.assignedTo ?? plan.dentistId ?? null,
            chargeDate: today,
            createdBy: ctx.actor.userId,
            planItemId: item.id,
            procedureName: item.procedureName,
            estimatedCost:
              item.estimatedCost == null ? null : Number(item.estimatedCost),
          },
          null,
        ),
      );
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(Charge)
        .values(drafts)
        .orIgnore()
        .returning(['id'])
        .execute();
      const createdIds = (result.raw as Array<{ id: string }>).map((r) => r.id);
      await this.audit.logMany(
        manager,
        ctx,
        createdIds.map((id) => ({
          entityType: BillingAuditEntity.CHARGE,
          entityId: id,
          action: BillingAuditAction.CREATED,
        })),
      );
      return ChargeQueries.byIds(manager, ctx.tenant, createdIds);
    });
  }

  /** Reception worklist: patients with unbilled charges on a clinic date. */
  async readyToBill(
    tenant: TenantContext,
    date?: string,
  ): Promise<ReadyToBillRow[]> {
    const day = date ?? (await this.clock.read(tenant.locationId)).today;
    const rows: Array<Record<string, string>> = await this.dataSource.query(
      `SELECT c.patient_id, p.full_name, p.phone, p.patient_number,
              COUNT(*)::int AS charge_count, SUM(c.net_amount) AS total,
              BOOL_OR(c.needs_pricing) AS needs_pricing, MAX(c.created_at) AS last_at
         FROM charges c
         JOIN patients p ON p.id = c.patient_id
        WHERE c.organization_id = $1 AND c.location_id = $2
          AND c.status = 'ACTIVE' AND c.invoice_id IS NULL AND c.charge_date <= $3
        GROUP BY c.patient_id, p.full_name, p.phone, p.patient_number
       HAVING BOOL_OR(c.charge_date = $3)
        ORDER BY MAX(c.created_at) DESC`,
      [tenant.organizationId, tenant.locationId, day],
    );
    return rows.map((r) => ({
      patientId: r.patient_id,
      patientName: r.full_name,
      phone: r.phone ?? null,
      mrn: r.patient_number ?? null,
      chargeCount: Number(r.charge_count),
      unbilledTotal: Number(r.total),
      needsPricing: Boolean(r.needs_pricing),
      lastChargeAt: new Date(r.last_at).toISOString(),
    }));
  }

  // ─── internals ────────────────────────────────────────────────────

  /** Lock → assert unbilled → mutate in memory → save → audit, in one tx. */
  private async mutateUnbilled(
    ctx: BillingContext,
    chargeId: string,
    action: BillingAuditAction,
    mutate: (
      manager: EntityManager,
      charge: Charge,
      now: Date,
    ) => void | Promise<void>,
    reason: string | null = null,
  ): Promise<ChargeResponse> {
    return this.dataSource.transaction(async (manager) => {
      const [charge] = (
        await BillingLocks.chargesWithInvoices(manager, ctx.tenant, [chargeId])
      ).charges;
      this.assertUnbilled(charge);
      const before = chargeSnapshot(charge);
      const { now } = await this.clock.read(ctx.tenant.locationId);
      await mutate(manager, charge, now);
      await manager.save(charge);
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.CHARGE,
        entityId: charge.id,
        action,
        before,
        after: chargeSnapshot(charge),
        reason:
          reason ??
          (action === BillingAuditAction.DISCOUNT_APPLIED
            ? charge.discountNote
            : null),
        amount:
          action === BillingAuditAction.DISCOUNT_APPLIED
            ? charge.discountAmount
            : null,
      });
      return this.view(manager, ctx.tenant, charge.id);
    });
  }

  private assertUnbilled(charge: Charge): void {
    if (charge.status !== ChargeStatus.ACTIVE) {
      throw billingError('BILLING_CHARGE_NOT_OPEN', 'This charge is void');
    }
    if (charge.invoiceId) {
      throw billingError(
        'BILLING_CHARGE_ALREADY_BILLED',
        'This charge is on an invoice — edit the invoice instead',
      );
    }
  }

  /** D5: reception may price only "Other" charges (or ones needing a price). */
  private assertCanSetPrice(
    ctx: BillingContext,
    charge: Pick<Charge, 'serviceId' | 'needsPricing'>,
  ): void {
    if (ctx.actor.isAdmin || !charge.serviceId || charge.needsPricing) return;
    throw billingError(
      'BILLING_PRICE_CHANGE_NOT_ALLOWED',
      'Only an admin can change a catalog price — give a discount instead',
    );
  }

  private async auditCharge(
    manager: EntityManager,
    ctx: BillingContext,
    charge: Charge,
    action: BillingAuditAction,
    before: Record<string, unknown> | null,
  ): Promise<void> {
    await this.audit.log(manager, ctx, {
      entityType: BillingAuditEntity.CHARGE,
      entityId: charge.id,
      action,
      before,
      after: chargeSnapshot(charge),
      amount: charge.netAmount,
    });
  }

  private async view(
    manager: EntityManager,
    tenant: TenantContext,
    id: string,
  ): Promise<ChargeResponse> {
    const [row] = await ChargeQueries.byIds(manager, tenant, [id]);
    return row;
  }
}
