import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { Treatment } from 'src/treatments/entities/treatment.entity';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { BillingAuditService } from '../audit/billing-audit.service';
import { BILLING_FEATURE } from '../billing.constants';
import {
  ChargePricingService,
  ResolvedPrice,
} from '../catalog/charge-pricing.service';
import { BillingClock } from '../common/billing-clock.service';
import {
  BillingContext,
  NO_BILLING_ACCESS,
  SYSTEM_BILLING_ROLE,
} from '../common/billing-context';
import { BillingException } from '../common/billing-errors';
import { Charge } from '../entities/charge.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  ChargeSource,
  ChargeStatus,
} from '../enums/billing.enums';
import { BillingSettingsService } from '../settings/billing-settings.service';
import { voidCharge } from './charge-math';
import {
  CommissionService,
  CommissionSnapshot,
} from '../commissions/commission.service';
import {
  ChargeDraft,
  ChargeDraftFactory,
} from './sources/charge-draft.factory';

export interface EncounterCompletion {
  tenant: TenantContext;
  queueEntryId: string;
  doctorId: string;
  completedAt: Date;
  actorUserId: string;
}

const REMOVED_REASON = 'Treatment removed by doctor';

/**
 * Automatic charges from a completed consultation (D4, 6.4). Runs inside
 * the queue's completion transaction, so it never throws on duplicates:
 * inserts are `ON CONFLICT DO NOTHING` on `uq_charges_source` and the
 * queue session lock already serialises completions of one entry.
 * Returns nothing — doctors' responses carry no charge data.
 */
@Injectable()
export class ChargeSourcesService {
  private readonly logger = new Logger(ChargeSourcesService.name);
  private readonly factory = new ChargeDraftFactory();

  constructor(
    private readonly pricing: ChargePricingService,
    private readonly settings: BillingSettingsService,
    private readonly audit: BillingAuditService,
    private readonly flags: FeatureFlagsService,
    private readonly clock: BillingClock,
    private readonly commissions: CommissionService,
  ) {}

  async syncForEncounter(
    manager: EntityManager,
    input: EncounterCompletion,
  ): Promise<void> {
    const { tenant } = input;
    if (
      !(await this.flags.isFeatureEnabled(
        tenant.organizationId,
        BILLING_FEATURE,
      ))
    )
      return;

    const encounter = await manager.getRepository(PatientEncounter).findOne({
      where: {
        queueEntryId: input.queueEntryId,
        organizationId: tenant.organizationId,
      },
      select: { id: true, patientId: true, appointmentId: true },
    });
    if (!encounter) return; // completed without a consultation: nothing to bill

    const ctx: BillingContext = {
      tenant,
      actor: {
        userId: input.actorUserId,
        employeeId: null,
        access: NO_BILLING_ACCESS,
        role: SYSTEM_BILLING_ROLE,
      },
    };
    const treatments = await manager.getRepository(Treatment).find({
      where: {
        encounterId: encounter.id,
        organizationId: tenant.organizationId,
      },
      select: { id: true, treatmentName: true, cost: true, serviceId: true },
    });
    const existing = await manager.getRepository(Charge).find({
      where: {
        organizationId: tenant.organizationId,
        encounterId: encounter.id,
        status: ChargeStatus.ACTIVE,
        source: In([ChargeSource.CONSULTATION, ChargeSource.TREATMENT]),
      },
    });

    const { tz } = await this.clock.read(tenant.locationId);
    const visit = {
      ...tenant,
      patientId: encounter.patientId,
      doctorId: input.doctorId,
      chargeDate: this.clock.dateOf(tz, input.completedAt),
      createdBy: input.actorUserId,
      encounterId: encounter.id,
      appointmentId: encounter.appointmentId,
    };
    const drafts: ChargeDraft[] = [];
    if (!existing.some((c) => c.source === ChargeSource.CONSULTATION)) {
      drafts.push(
        this.factory.fromConsultation(
          visit,
          await this.consultationPrice(manager, input),
        ),
      );
    }
    const billed = new Set(existing.map((c) => c.sourceId));
    for (const t of treatments.filter((t) => !billed.has(t.id))) {
      const price = t.serviceId
        ? await this.safePrice(manager, tenant, t.serviceId, input.doctorId)
        : null;
      drafts.push(
        this.factory.fromTreatment(
          {
            ...visit,
            treatmentId: t.id,
            treatmentName: t.treatmentName,
            legacyCost: t.cost == null ? null : Number(t.cost),
          },
          price,
        ),
      );
    }

    // Commission snapshot in the same transaction: the doctor's plan in force
    // on the clinic date, resolved per service (internal; never on invoices).
    const snapshots = await this.commissions.snapshot(
      manager,
      tenant,
      input.doctorId,
      visit.chargeDate,
      drafts,
    );
    const createdIds = await this.insert(
      manager,
      drafts.map((d, i) => ({ ...d, ...snapshots[i] })),
    );
    const voidedIds = await this.handleRemoved(
      manager,
      existing,
      treatments,
      input,
    );
    await this.audit.logMany(manager, ctx, [
      ...createdIds.map((id) => ({
        entityType: BillingAuditEntity.CHARGE,
        entityId: id,
        action: BillingAuditAction.CREATED,
      })),
      ...voidedIds.map((id) => ({
        entityType: BillingAuditEntity.CHARGE,
        entityId: id,
        action: BillingAuditAction.VOIDED,
        reason: REMOVED_REASON,
      })),
    ]);
  }

  /** Unbilled → void; billed → keep the money, flag for review (6.4 step 5). */
  private async handleRemoved(
    manager: EntityManager,
    existing: Charge[],
    treatments: Array<Pick<Treatment, 'id'>>,
    input: EncounterCompletion,
  ): Promise<string[]> {
    const current = new Set(treatments.map((t) => t.id));
    const removed = existing.filter(
      (c) =>
        c.source === ChargeSource.TREATMENT &&
        c.sourceId &&
        !current.has(c.sourceId),
    );
    const voided: string[] = [];
    for (const charge of removed) {
      if (charge.invoiceId) {
        if (!charge.sourceRemovedAt) charge.sourceRemovedAt = input.completedAt;
      } else {
        voidCharge(
          charge,
          REMOVED_REASON,
          input.actorUserId,
          input.completedAt,
        );
        voided.push(charge.id);
      }
    }
    if (removed.length) await manager.save(removed);
    return voided;
  }

  private async insert(
    manager: EntityManager,
    drafts: Array<ChargeDraft & CommissionSnapshot>,
  ): Promise<string[]> {
    if (!drafts.length) return [];
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(Charge)
      .values(drafts)
      .orIgnore()
      .returning(['id'])
      .execute();
    return (result.raw as Array<{ id: string }>).map((r) => r.id);
  }

  private async consultationPrice(
    manager: EntityManager,
    input: EncounterCompletion,
  ): Promise<ResolvedPrice | null> {
    const settings = await this.settings.getOrCreate(manager, input.tenant);
    if (!settings.defaultConsultationServiceId) return null;
    return this.safePrice(
      manager,
      input.tenant,
      settings.defaultConsultationServiceId,
      input.doctorId,
    );
  }

  /** A misconfigured catalog must never block the doctor: fall back to needsPricing. */
  private async safePrice(
    manager: EntityManager,
    tenant: TenantContext,
    serviceId: string,
    doctorId: string,
  ): Promise<ResolvedPrice | null> {
    try {
      return await this.pricing.resolve(manager, tenant, serviceId, doctorId);
    } catch (err) {
      if (!(err instanceof BillingException)) throw err;
      this.logger.warn(
        `Price for service ${serviceId} unavailable (${err.code}); charge needs pricing`,
      );
      return null;
    }
  }
}
