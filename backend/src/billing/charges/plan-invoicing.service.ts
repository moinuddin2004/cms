import { Injectable } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PatientTreatmentPlan } from 'src/patients/entities/patient-treatment-plan.entity';
import { TreatmentPlanItem } from 'src/patients/entities/treatment-plan-item.entity';
import { PlanItemStatus } from 'src/patients/enums/plan-item-status.enum';
import { TreatmentPlanStatus } from 'src/patients/enums/treatment-plan-status.enum';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { BillingAuditService } from '../audit/billing-audit.service';
import { BILLING_FEATURE } from '../billing.constants';
import { ChargePricingService } from '../catalog/charge-pricing.service';
import { BillingClock } from '../common/billing-clock.service';
import {
  BillingContext,
  NO_BILLING_ACCESS,
  SYSTEM_BILLING_ROLE,
} from '../common/billing-context';
import { fromPaisa, splitProportionally, toPaisa } from '../common/money';
import { CommissionService } from '../commissions/commission.service';
import { Charge } from '../entities/charge.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  DiscountKind,
  ServiceKind,
} from '../enums/billing.enums';
import { InvoiceIssuer } from '../invoices/invoice-issuer.service';
import { ChargeDraftFactory } from './sources/charge-draft.factory';

/** One plan line, priced and locked by the plan. */
export interface PlanInvoiceLine {
  planItemId: string;
  serviceId: string | null;
  description: string;
  /** Locked plan price (rupees, before the plan discount). */
  price: number;
  doctorId: string | null;
}

export interface PlanInvoiceInput {
  tenant: TenantContext;
  patientId: string;
  planNumber: string;
  lines: PlanInvoiceLine[];
  /** Whole-plan discount (rupees); spread over the lines by price. */
  discount: number;
  actorUserId: string;
}

/**
 * Billing side of treatment plans. Lives in billing so the plan module stays
 * free of charge / invoice code; exported for it.
 */
@Injectable()
export class PlanInvoicingService {
  private readonly factory = new ChargeDraftFactory();

  constructor(
    private readonly pricing: ChargePricingService,
    private readonly flags: FeatureFlagsService,
    private readonly clock: BillingClock,
    private readonly commissions: CommissionService,
    private readonly issuer: InvoiceIssuer,
    private readonly audit: BillingAuditService,
  ) {}

  /**
   * Starts a plan: accepted if still a draft, its one invoice issued, and its
   * services and prices locked (`startedAt`). No-op once started. `plan`
   * must be row-locked with its items loaded; the caller saves it.
   */
  async start(
    manager: EntityManager,
    plan: PatientTreatmentPlan,
    input: { tenant: TenantContext; actorUserId: string; at: Date },
  ): Promise<void> {
    if (plan.startedAt) return;
    const { today } = await this.clock.read(input.tenant.locationId);
    if (plan.status === TreatmentPlanStatus.DRAFT) {
      plan.status = TreatmentPlanStatus.ACTIVE;
      plan.patientAccepted = true;
      plan.patientAcceptedAt = input.at;
    }
    plan.startedAt = input.at;
    plan.startDate = today as unknown as Date;
    plan.invoiceId = await this.issue(manager, {
      tenant: input.tenant,
      patientId: plan.patientId,
      planNumber: plan.planNumber,
      discount: Number(plan.discountAmount ?? 0),
      actorUserId: input.actorUserId,
      lines: plan.items
        .filter((i) => i.status !== PlanItemStatus.SKIPPED)
        .map((i) => ({
          planItemId: i.id,
          serviceId: i.serviceId,
          description: i.toothNumber
            ? `${i.procedureName} #${i.toothNumber}`
            : i.procedureName,
          price: Number(i.estimatedCost ?? 0),
          doctorId: i.assignedTo ?? plan.dentistId,
        })),
    });
  }

  /**
   * Visit completion: the patient's plans made in this visit, and any plan
   * they already accepted, get their bill now if they have none yet. A
   * draft from an earlier visit (patient still deciding) is left alone.
   * Runs in the completion transaction.
   */
  async startForVisit(
    manager: EntityManager,
    input: {
      tenant: TenantContext;
      patientId: string;
      encounterId: string;
      actorUserId: string;
      at: Date;
    },
  ): Promise<void> {
    if (
      !(await this.flags.isFeatureEnabled(
        input.tenant.organizationId,
        BILLING_FEATURE,
      ))
    )
      return;
    const repo = manager.getRepository(PatientTreatmentPlan);
    const scope = {
      patientId: input.patientId,
      organizationId: input.tenant.organizationId,
      status: In([TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.ACTIVE]),
      startedAt: IsNull(),
    };
    const plans = await repo.find({
      where: [
        { ...scope, encounterId: input.encounterId },
        { ...scope, patientAccepted: true },
      ],
      lock: { mode: 'pessimistic_write' },
    });
    for (const plan of plans) {
      plan.items = await manager
        .getRepository(TreatmentPlanItem)
        .find({ where: { planId: plan.id } });
      if (!plan.items.length) continue;
      await this.start(manager, plan, input);
      await repo.save(plan);
    }
  }

  /** The service's price for this location (and doctor, when one is set). */
  async price(
    manager: EntityManager,
    tenant: TenantContext,
    serviceId: string,
    doctorId: string | null,
  ): Promise<{ name: string; price: number }> {
    const p = await this.pricing.resolve(manager, tenant, serviceId, doctorId);
    return { name: p.description, price: p.unitPrice };
  }

  /**
   * One invoice for the whole plan: a charge per line, the plan discount
   * split over them by price (shares always sum to the discount). The
   * patient then pays it off over the visits. Returns null when billing is
   * off for the clinic. Runs inside the caller's transaction.
   */
  async issue(
    manager: EntityManager,
    input: PlanInvoiceInput,
  ): Promise<string | null> {
    const { tenant } = input;
    if (
      !input.lines.length ||
      !(await this.flags.isFeatureEnabled(
        tenant.organizationId,
        BILLING_FEATURE,
      ))
    )
      return null;

    const ctx: BillingContext = {
      tenant,
      actor: {
        userId: input.actorUserId,
        employeeId: null,
        access: NO_BILLING_ACCESS,
        role: SYSTEM_BILLING_ROLE,
      },
    };
    const time = await this.clock.read(tenant.locationId);
    const grossPaisa = input.lines.map((l) => toPaisa(l.price));
    const discountPaisa = Math.min(
      toPaisa(input.discount),
      grossPaisa.reduce((a, b) => a + b, 0),
    );
    const shares = splitProportionally(discountPaisa, grossPaisa);
    const label = `Plan ${input.planNumber}`.slice(0, 80);

    const drafts = input.lines.map((line, i) => {
      const draft = this.factory.fromPlanItem(
        {
          ...tenant,
          patientId: input.patientId,
          doctorId: line.doctorId,
          chargeDate: time.today,
          createdBy: input.actorUserId,
          planItemId: line.planItemId,
          procedureName: line.description,
          estimatedCost: line.price,
        },
        line.serviceId
          ? {
              serviceId: line.serviceId,
              unitPrice: line.price,
              description: line.description,
              serviceKind: ServiceKind.PROCEDURE,
              level: 'DEFAULT',
            }
          : null,
      );
      // A zero price is a real (free) line, not a missing one.
      draft.unitPrice = line.price;
      draft.grossAmount = fromPaisa(grossPaisa[i]);
      draft.needsPricing = false;
      const share = shares[i];
      draft.discountAmount = fromPaisa(share);
      draft.netAmount = fromPaisa(grossPaisa[i] - share);
      return {
        ...draft,
        ...(share > 0
          ? {
              discountName: label,
              discountKind: DiscountKind.FIXED,
              discountValue: fromPaisa(share),
              discountNote: 'Treatment plan discount',
              discountAppliedBy: input.actorUserId,
              isCustomDiscount: true,
            }
          : {}),
      };
    });

    // Commission is snapshotted per doctor, as on visit charges.
    const snapshots = new Array<object>(drafts.length);
    const byDoctor = new Map<string | null, number[]>();
    drafts.forEach((d, i) => {
      const list = byDoctor.get(d.doctorId) ?? [];
      list.push(i);
      byDoctor.set(d.doctorId, list);
    });
    for (const [doctorId, idx] of byDoctor) {
      const snaps = await this.commissions.snapshot(
        manager,
        tenant,
        doctorId,
        time.today,
        idx.map((i) => drafts[i]),
      );
      idx.forEach((i, k) => (snapshots[i] = snaps[k]));
    }

    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(Charge)
      .values(drafts.map((d, i) => ({ ...d, ...snapshots[i] })))
      .returning(['id'])
      .execute();
    const ids = (result.raw as Array<{ id: string }>).map((r) => r.id);
    await this.audit.logMany(
      manager,
      ctx,
      ids.map((id) => ({
        entityType: BillingAuditEntity.CHARGE,
        entityId: id,
        action: BillingAuditAction.CREATED,
      })),
    );
    const charges = await manager
      .getRepository(Charge)
      .find({ where: { id: In(ids) } });
    const invoice = await this.issuer.issue(
      manager,
      ctx,
      time,
      charges,
      `Treatment plan ${input.planNumber}`,
    );
    return invoice.id;
  }
}
