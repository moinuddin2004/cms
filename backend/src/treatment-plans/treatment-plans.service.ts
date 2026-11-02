import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AccessContext } from 'src/access/access-context';
import { AuditService } from 'src/common/audit/audit.service';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { ClockService } from 'src/common/clock/clock.service';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PlanInvoicingService } from 'src/billing/charges/plan-invoicing.service';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { PatientTreatmentPlan } from 'src/patients/entities/patient-treatment-plan.entity';
import { TreatmentPlanItem } from 'src/patients/entities/treatment-plan-item.entity';
import { PlanItemStatus } from 'src/patients/enums/plan-item-status.enum';
import { TreatmentPlanStatus } from 'src/patients/enums/treatment-plan-status.enum';
import {
  PATIENT_AUDIT_ENTITY,
  patientRecordSnapshot,
  recordPatientChange,
} from 'src/patients/patient-audit';
import { PlanTemplate } from 'src/plan-templates/entities/plan-template.entity';
import { Treatment } from 'src/treatments/entities/treatment.entity';
import {
  CreateTreatmentPlanDto,
  PlanDiscountDto,
  PlanLineDto,
  PlanSessionDto,
  UpdateTreatmentPlanDto,
} from './dto/treatment-plan.dto';
import { normalizeDiscount, planTotals } from './plan-pricing';

const DISCOUNT_PERM = 'billing.discount.apply';
const OPEN = [TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.ACTIVE];

/**
 * A patient's treatment plan: services from the catalog, prices locked on
 * the plan, one plan discount. The first session issues ONE invoice for the
 * whole plan (the patient pays it off over the visits); from then on the
 * plan's services and prices are fixed. Each session is recorded as a
 * treatment on the visit, which visit billing skips.
 */
@Injectable()
export class TreatmentPlansService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly invoicing: PlanInvoicingService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
  ) {}

  async list(
    patientId: string,
    tenant: TenantContext,
  ): Promise<PatientTreatmentPlan[]> {
    await this.patientOrFail(this.dataSource.manager, patientId, tenant);
    const plans = await this.dataSource
      .getRepository(PatientTreatmentPlan)
      .find({
        where: { patientId, organizationId: tenant.organizationId },
        relations: ['items'],
        order: { createdAt: 'DESC' },
      });
    plans.forEach(sortItems);
    return plans;
  }

  create(
    patientId: string,
    tenant: TenantContext,
    access: AccessContext,
    dto: CreateTreatmentPlanDto,
    actor: ActorRef,
  ): Promise<PatientTreatmentPlan> {
    return this.dataSource.transaction(async (m) => {
      await this.patientOrFail(m, patientId, tenant);
      const dentistId = dto.dentistId ?? access.employeeId;
      if (!dentistId) {
        throw new BadRequestException('Choose the doctor for this plan');
      }
      const template = dto.planTemplateId
        ? await m.getRepository(PlanTemplate).findOne({
            where: {
              id: dto.planTemplateId,
              organizationId: tenant.organizationId,
            },
          })
        : null;
      if (dto.planTemplateId && !template) {
        throw new NotFoundException('Treatment plan template not found');
      }
      if (dto.encounterId)
        await this.encounterOrFail(m, dto.encounterId, patientId, tenant);

      // Without the discount permission the template's discount still applies.
      const discount =
        access.can(DISCOUNT_PERM) && dto.discountKind !== undefined
          ? normalizeDiscount(dto.discountKind, dto.discountValue)
          : normalizeDiscount(template?.discountKind, template?.discountValue);

      const repo = m.getRepository(PatientTreatmentPlan);
      const plan = repo.create({
        patientId,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
        dentistId,
        planNumber: await this.nextPlanNumber(m, tenant.organizationId),
        planName: '',
        description: null,
        notes: dto.notes?.trim() || null,
        planTemplateId: template?.id ?? null,
        encounterId: dto.encounterId ?? null,
        discountKind: discount.kind,
        discountValue: discount.value,
        status: TreatmentPlanStatus.DRAFT,
        createdBy: actor.userId,
      });
      const items = await this.priceLines(m, tenant, dto.items, [], dentistId);
      plan.planName =
        dto.planName?.trim() || template?.name || defaultName(items);
      Object.assign(plan, totalsOf(items, plan));
      const saved = await repo.save(plan);
      saved.items = await m
        .getRepository(TreatmentPlanItem)
        .save(items.map((i) => ({ ...i, planId: saved.id })));
      await this.record(m, actor, saved, null);
      sortItems(saved);
      return saved;
    });
  }

  update(
    patientId: string,
    planId: string,
    tenant: TenantContext,
    access: AccessContext,
    dto: UpdateTreatmentPlanDto,
    actor: ActorRef,
  ): Promise<PatientTreatmentPlan> {
    return this.dataSource.transaction(async (m) => {
      const plan = await this.editableOrFail(m, patientId, planId, tenant);
      const before = patientRecordSnapshot(m, PatientTreatmentPlan, plan);

      if (dto.discountKind !== undefined || dto.discountValue !== undefined) {
        if (!access.can(DISCOUNT_PERM)) {
          throw new ForbiddenException('You cannot give a discount');
        }
        const d = normalizeDiscount(
          dto.discountKind === undefined ? plan.discountKind : dto.discountKind,
          dto.discountValue === undefined
            ? plan.discountValue
            : dto.discountValue,
        );
        plan.discountKind = d.kind;
        plan.discountValue = d.value;
      }
      if (dto.planName !== undefined && dto.planName.trim()) {
        plan.planName = dto.planName.trim();
      }
      if (dto.notes !== undefined) plan.notes = dto.notes?.trim() || null;

      if (dto.items) {
        const itemRepo = m.getRepository(TreatmentPlanItem);
        const keepIds = new Set(dto.items.map((i) => i.id).filter(Boolean));
        const removed = plan.items.filter((i) => !keepIds.has(i.id));
        if (removed.length) await itemRepo.remove(removed);
        const kept = plan.items.filter((i) => keepIds.has(i.id));
        const priced = await this.priceLines(
          m,
          tenant,
          dto.items,
          // An accepted plan keeps the prices the patient agreed to.
          plan.status === TreatmentPlanStatus.ACTIVE ? kept : [],
          plan.dentistId,
        );
        plan.items = await itemRepo.save(
          priced.map((i) => ({ ...i, planId: plan.id })),
        );
      }
      Object.assign(plan, totalsOf(plan.items, plan));
      const saved = await m.getRepository(PatientTreatmentPlan).save(plan);
      await this.record(m, actor, saved, before);
      sortItems(saved);
      return saved;
    });
  }

  /** Reception's discount, without touching the services. */
  setDiscount(
    patientId: string,
    planId: string,
    tenant: TenantContext,
    access: AccessContext,
    dto: PlanDiscountDto,
    actor: ActorRef,
  ): Promise<PatientTreatmentPlan> {
    return this.update(
      patientId,
      planId,
      tenant,
      access,
      {
        discountKind: dto.discountKind ?? null,
        discountValue: dto.discountValue ?? null,
      },
      actor,
    );
  }

  /** The patient agreed: prices are locked from now on. */
  accept(
    patientId: string,
    planId: string,
    tenant: TenantContext,
    actor: ActorRef,
  ): Promise<PatientTreatmentPlan> {
    return this.dataSource.transaction(async (m) => {
      const plan = await this.planOrFail(m, patientId, planId, tenant, true);
      if (plan.status !== TreatmentPlanStatus.DRAFT) return plan;
      const before = patientRecordSnapshot(m, PatientTreatmentPlan, plan);
      markAccepted(plan, this.clock.now());
      const saved = await m.getRepository(PatientTreatmentPlan).save(plan);
      await this.record(m, actor, saved, before);
      return saved;
    });
  }

  /**
   * One session of a step was done. The plan's first session issues its
   * invoice; the session itself is recorded as a (non-billed) treatment.
   */
  session(
    patientId: string,
    planId: string,
    itemId: string,
    tenant: TenantContext,
    dto: PlanSessionDto,
    actor: ActorRef,
  ): Promise<PatientTreatmentPlan> {
    return this.dataSource.transaction(async (m) => {
      const plan = await this.planOrFail(m, patientId, planId, tenant, true);
      if (!OPEN.includes(plan.status)) {
        throw new ConflictException('This plan is closed');
      }
      const item = plan.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Plan step not found');
      if (
        item.status === PlanItemStatus.SKIPPED ||
        item.completedSessions >= item.estimatedSessions
      ) {
        throw new ConflictException('All sessions of this step are done');
      }
      if (dto.encounterId) {
        await this.encounterOrFail(m, dto.encounterId, patientId, tenant);
      }

      const before = patientRecordSnapshot(m, PatientTreatmentPlan, plan);
      const now = this.clock.now();
      const today = this.clock.today(
        await this.clock.timezoneFor(tenant.locationId),
        now,
      );
      // First session of an unbilled plan: accept it and issue its bill.
      await this.invoicing.start(m, plan, {
        tenant,
        actorUserId: actor.userId ?? '',
        at: now,
      });

      item.completedSessions += 1;
      item.status =
        item.completedSessions >= item.estimatedSessions
          ? PlanItemStatus.COMPLETED
          : PlanItemStatus.IN_PROGRESS;
      await m.getRepository(TreatmentPlanItem).save(item);

      const session =
        item.estimatedSessions > 1
          ? ` (session ${item.completedSessions}/${item.estimatedSessions})`
          : '';
      await m.getRepository(Treatment).save(
        m.getRepository(Treatment).create({
          patientId,
          encounterId: dto.encounterId ?? null,
          organizationId: tenant.organizationId,
          locationId: tenant.locationId,
          planTemplateId: plan.planTemplateId,
          planItemId: item.id,
          serviceId: item.serviceId,
          treatmentName: `${lineLabel(item)}${session}`.slice(0, 200),
          notes: dto.notes?.trim() || null,
          cost: null,
          date: now,
          createdBy: actor.userId,
        }),
      );

      if (
        plan.items.every(
          (i) =>
            i.status === PlanItemStatus.COMPLETED ||
            i.status === PlanItemStatus.SKIPPED,
        )
      ) {
        plan.status = TreatmentPlanStatus.COMPLETED;
        plan.actualEndDate = today as unknown as Date;
      }
      const saved = await m.getRepository(PatientTreatmentPlan).save(plan);
      await this.record(m, actor, saved, before);
      sortItems(saved);
      return saved;
    });
  }

  /**
   * Stops the plan; steps not done are skipped. An issued invoice is left to
   * reception (remove the lines not done, refund or keep as advance).
   */
  cancel(
    patientId: string,
    planId: string,
    tenant: TenantContext,
    actor: ActorRef,
  ): Promise<PatientTreatmentPlan> {
    return this.dataSource.transaction(async (m) => {
      const plan = await this.planOrFail(m, patientId, planId, tenant, true);
      if (!OPEN.includes(plan.status)) {
        throw new ConflictException('This plan is already closed');
      }
      const before = patientRecordSnapshot(m, PatientTreatmentPlan, plan);
      plan.status = TreatmentPlanStatus.CANCELLED;
      const open = plan.items.filter(
        (i) => i.status !== PlanItemStatus.COMPLETED,
      );
      open.forEach((i) => (i.status = PlanItemStatus.SKIPPED));
      if (open.length) await m.getRepository(TreatmentPlanItem).save(open);
      const saved = await m.getRepository(PatientTreatmentPlan).save(plan);
      await this.record(m, actor, saved, before);
      sortItems(saved);
      return saved;
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /**
   * Plan lines with their price from the catalog — or, for a line in
   * `locked` with the same service, the price already agreed.
   */
  private async priceLines(
    m: EntityManager,
    tenant: TenantContext,
    lines: PlanLineDto[],
    locked: TreatmentPlanItem[],
    dentistId: string,
  ): Promise<TreatmentPlanItem[]> {
    const repo = m.getRepository(TreatmentPlanItem);
    const existing = new Map(locked.map((i) => [i.id, i]));
    const out: TreatmentPlanItem[] = [];
    for (const [index, line] of lines.entries()) {
      const prev = line.id ? existing.get(line.id) : undefined;
      const keepPrice = prev && prev.serviceId === line.serviceId;
      const { name, price } = await this.invoicing.price(
        m,
        tenant,
        line.serviceId,
        dentistId,
      );
      const item = prev ?? repo.create({ completedSessions: 0 });
      Object.assign(item, {
        serviceId: line.serviceId,
        procedureName: name.slice(0, 200),
        toothNumber: line.toothNumber?.trim() || null,
        estimatedSessions: Math.max(
          line.estimatedSessions,
          item.completedSessions,
        ),
        estimatedCost: keepPrice ? prev.estimatedCost : price,
        sequenceOrder: index + 1,
        notes: line.notes?.trim() || null,
        status: item.status ?? PlanItemStatus.PENDING,
      });
      out.push(item);
    }
    return out;
  }

  private async editableOrFail(
    m: EntityManager,
    patientId: string,
    planId: string,
    tenant: TenantContext,
  ): Promise<PatientTreatmentPlan> {
    const plan = await this.planOrFail(m, patientId, planId, tenant, true);
    if (!OPEN.includes(plan.status)) {
      throw new ConflictException('This plan is closed');
    }
    if (plan.startedAt) {
      throw new ConflictException(
        'Treatment has started, so the plan is locked. Change the bill from Billing.',
      );
    }
    return plan;
  }

  private async planOrFail(
    m: EntityManager,
    patientId: string,
    planId: string,
    tenant: TenantContext,
    lock = false,
  ): Promise<PatientTreatmentPlan> {
    const repo = m.getRepository(PatientTreatmentPlan);
    const where = {
      id: planId,
      patientId,
      organizationId: tenant.organizationId,
    };
    // Row lock first (no joins allowed with FOR UPDATE), then load items.
    const plan = lock
      ? await repo.findOne({ where, lock: { mode: 'pessimistic_write' } })
      : await repo.findOne({ where });
    if (!plan) throw new NotFoundException('Treatment plan not found');
    plan.items = await m
      .getRepository(TreatmentPlanItem)
      .find({ where: { planId: plan.id }, order: { sequenceOrder: 'ASC' } });
    return plan;
  }

  /** The visit must be this patient's, in this clinic. */
  private async encounterOrFail(
    m: EntityManager,
    encounterId: string,
    patientId: string,
    tenant: TenantContext,
  ): Promise<void> {
    const found = await m.getRepository(PatientEncounter).exists({
      where: {
        id: encounterId,
        patientId,
        organizationId: tenant.organizationId,
      },
    });
    if (!found) throw new NotFoundException('Encounter not found');
  }

  private async patientOrFail(
    m: EntityManager,
    patientId: string,
    tenant: TenantContext,
  ): Promise<void> {
    const found = await m.getRepository(Patient).exists({
      where: { id: patientId, organizationId: tenant.organizationId },
    });
    if (!found) throw new NotFoundException('Patient not found');
  }

  private async nextPlanNumber(
    m: EntityManager,
    organizationId: string,
  ): Promise<string> {
    const count = await m.getRepository(PatientTreatmentPlan).count({
      where: { organizationId },
      withDeleted: true,
    });
    return `TP-${String(count + 1).padStart(5, '0')}`;
  }

  private record(
    m: EntityManager,
    actor: ActorRef,
    plan: PatientTreatmentPlan,
    before: ReturnType<typeof patientRecordSnapshot> | null,
  ): Promise<boolean> {
    return recordPatientChange(this.audit, m, actor, {
      organizationId: plan.organizationId,
      patientId: plan.patientId,
      entityType: PATIENT_AUDIT_ENTITY.TREATMENT_PLAN,
      entityId: plan.id,
      before,
      after: patientRecordSnapshot(m, PatientTreatmentPlan, plan),
    });
  }
}

function totalsOf(
  items: TreatmentPlanItem[],
  plan: Pick<PatientTreatmentPlan, 'discountKind' | 'discountValue'>,
) {
  return planTotals(
    items.map((i) => (i.estimatedCost == null ? 0 : Number(i.estimatedCost))),
    { kind: plan.discountKind, value: plan.discountValue },
  );
}

function markAccepted(plan: PatientTreatmentPlan, at: Date): void {
  plan.status = TreatmentPlanStatus.ACTIVE;
  plan.patientAccepted = true;
  plan.patientAcceptedAt = at;
}

/** "RCT #36" — what the invoice line and the visit history show. */
function lineLabel(
  i: Pick<TreatmentPlanItem, 'procedureName' | 'toothNumber'>,
) {
  return i.toothNumber
    ? `${i.procedureName} #${i.toothNumber}`
    : i.procedureName;
}

function defaultName(items: TreatmentPlanItem[]): string {
  const names = items.map(lineLabel);
  const head = names.slice(0, 2).join(' + ');
  return (names.length > 2 ? `${head} +${names.length - 2}` : head).slice(
    0,
    200,
  );
}

function sortItems(plan: PatientTreatmentPlan): void {
  plan.items?.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}
