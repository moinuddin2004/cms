import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { pgError, sqlRows } from 'src/common/database/sql';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { AppRole } from 'src/common/enums/app-role.enum';
import { FormResolverService } from 'src/engine/forms/form-resolver.service';
import type { FormDefinition } from 'src/engine/forms/form-definition.types';
import { FormSchemaVersion } from 'src/engine/entities/form-schema-version.entity';
import { catalogError } from 'src/lab-catalog/common/catalog-errors';
import { LabServiceOption } from 'src/lab-catalog/entities/lab-service-option.entity';
import { LabService } from 'src/lab-catalog/entities/lab-service.entity';
import { OrderTemplate } from 'src/lab-catalog/entities/order-template.entity';
import { OrderTemplatesService } from 'src/lab-catalog/templates/order-templates.service';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import { LabLinkStatus } from 'src/labs/enums/lab.enums';
import { ClinicCall } from '../common/order-context';
import { orderError } from '../common/order-errors';
import {
  CreateOrderDto,
  FromTemplateDto,
  OrderItemDto,
  RepeatOrderDto,
  UpdateOrderDto,
} from '../dto/order.dto';
import { ItemFormResponse } from '../entities/item-parts.entity';
import { LabOrderItem } from '../entities/lab-order-item.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { ORDER_ENTITY, OrderPriority } from '../enums/order.enums';
import { OrderWorkflowService } from '../workflow/order-workflow.service';

const DRAFT = 'draft';

/**
 * Draft orders (lab ERD §14.2): created from scratch, from an order
 * template or by repeating an earlier order. Drafts are not validated
 * beyond what keeps them coherent (patient, linked lab, its services);
 * form answers are checked at submit. Each line pins its form and item
 * workflow version when it is added, and the order pins its workflow at
 * create — none of them change afterwards (inv. 7).
 */
@Injectable()
export class OrderDraftsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly workflow: OrderWorkflowService,
    private readonly forms: FormResolverService,
    private readonly templates: OrderTemplatesService,
  ) {}

  async create(
    c: ClinicCall,
    dto: CreateOrderDto,
    idempotencyKey: string | null,
    templateId: string | null = null,
  ): Promise<string> {
    const org = c.tenant.organizationId;
    const key = idempotencyKey?.trim() || null;
    if (key) {
      const existing = await this.byKey(org, key);
      if (existing) return existing;
    }
    try {
      return await this.dataSource.transaction(async (m) => {
        await this.assertPatient(m, org, dto.patientId);
        const link = await this.activeLink(m, org, dto.labId);
        const doctorId = await this.doctorFor(m, c, dto.doctorId);
        await this.assertAppointment(m, org, dto.patientId, dto.appointmentId);
        const services = await this.services(m, dto.labId, dto.items);
        const specialtyId = this.oneSpecialty(services);

        const repo = m.getRepository(LabOrder);
        const order = await repo.save(
          repo.create({
            organizationId: org,
            locationId: c.tenant.locationId,
            specialtyId,
            patientId: dto.patientId,
            doctorId,
            labId: dto.labId,
            labClinicLinkId: link.id,
            workflowTemplateVersionId: await this.workflow.pinWorkflowVersion(
              m,
              org,
              specialtyId,
              'order',
            ),
            statusCode: DRAFT,
            priority: dto.priority ?? OrderPriority.NORMAL,
            requestedOn: dto.requestedOn ?? null,
            appointmentId: dto.appointmentId ?? null,
            treatmentId: dto.treatmentId ?? null,
            orderTemplateId: templateId,
            notes: dto.notes ?? null,
            idempotencyKey: key,
            createdBy: c.actor.userId,
            updatedBy: c.actor.userId,
          }),
        );
        await this.writeItems(m, c, order, dto.items, services, []);
        await this.audit.recordStatus(m, c.ref, {
          organizationId: org,
          entityType: ORDER_ENTITY.ORDER,
          entityId: order.id,
          fromState: null,
          toState: DRAFT,
          actionCode: 'create',
        });
        await this.audit.record(m, c.ref, {
          organizationId: org,
          entityType: ORDER_ENTITY.ORDER,
          entityId: order.id,
          action: AuditAction.CREATE,
          after: {
            patientId: order.patientId,
            labId: order.labId,
            items: dto.items.length,
            templateId,
          },
        });
        return order.id;
      });
    } catch (err) {
      // Two requests with the same key raced: the loser returns the winner's draft.
      const { code, constraint } = pgError(err);
      if (
        key &&
        code === '23505' &&
        constraint === 'uq_lab_orders_org_idempotency'
      ) {
        const existing = await this.byKey(org, key);
        if (existing) return existing;
      }
      throw err;
    }
  }

  async update(c: ClinicCall, id: string, dto: UpdateOrderDto): Promise<void> {
    const org = c.tenant.organizationId;
    await this.dataSource.transaction(async (m) => {
      const order = await this.lockDraft(m, org, id);
      assertVersion(order.version, dto.version);
      const before = this.headerSnapshot(order);

      if (dto.doctorId !== undefined) {
        order.doctorId = dto.doctorId
          ? await this.doctorFor(m, c, dto.doctorId)
          : null;
      }
      if (dto.appointmentId !== undefined) {
        await this.assertAppointment(
          m,
          org,
          order.patientId,
          dto.appointmentId,
        );
        order.appointmentId = dto.appointmentId ?? null;
      }
      if (dto.priority) order.priority = dto.priority;
      if (dto.requestedOn !== undefined) order.requestedOn = dto.requestedOn;
      if (dto.treatmentId !== undefined) order.treatmentId = dto.treatmentId;
      if (dto.notes !== undefined) order.notes = dto.notes;
      order.updatedBy = c.actor.userId;

      if (dto.items) {
        const services = await this.services(m, order.labId, dto.items);
        if (this.oneSpecialty(services) !== order.specialtyId) {
          throw orderError(
            'LAB_ORDER_INVALID',
            'All lines must be of the order’s specialty',
          );
        }
        const existing = await m
          .getRepository(LabOrderItem)
          .findBy({ orderId: order.id });
        await this.writeItems(m, c, order, dto.items, services, existing);
      }
      // Bump the version even when only lines changed.
      order.updatedAt = new Date();
      await m.getRepository(LabOrder).save(order);
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: ORDER_ENTITY.ORDER,
        entityId: order.id,
        action: AuditAction.UPDATE,
        before: { ...before, items: null },
        after: {
          ...this.headerSnapshot(order),
          items: dto.items ? dto.items.length : null,
        },
      });
    });
  }

  /** A draft from an order template (lab ERD §13 "Doctor speed"). */
  async fromTemplate(c: ClinicCall, dto: FromTemplateDto): Promise<string> {
    const org = c.tenant.organizationId;
    // Visibility (private templates stay private) is the catalog's rule.
    await this.templates.get(org, c.actor, dto.templateId);
    const t = await this.dataSource
      .getRepository(OrderTemplate)
      .findOneByOrFail({ id: dto.templateId, organizationId: org });
    if (!t.isActive || !t.labId) {
      throw orderError('LAB_ORDER_INVALID', 'This template can’t be used');
    }
    const { templateId, ...header } = dto;
    return this.create(
      c,
      {
        ...header,
        labId: t.labId,
        notes: dto.notes ?? t.templateJson.notes ?? null,
        items: t.templateJson.items.map((i) => ({
          labServiceId: i.labServiceId,
          optionIds: i.optionIds,
          quantity: i.quantity,
          rush: i.rush,
          answers: i.answers,
        })),
      },
      null,
      templateId,
    );
  }

  /**
   * "Repeat last order": a new draft with the same lab, lines and answers,
   * on the current form versions. Uploaded files never carry over; teeth
   * carry over only for the same patient.
   */
  async repeat(
    c: ClinicCall,
    id: string,
    dto: RepeatOrderDto,
  ): Promise<string> {
    const org = c.tenant.organizationId;
    const source = await this.dataSource.getRepository(LabOrder).findOne({
      where: { id, organizationId: org },
      relations: { items: true },
    });
    if (!source) throw orderError('LAB_ORDER_NOT_FOUND', 'Order not found');
    const patientId = dto.patientId ?? source.patientId;
    const samePatient = patientId === source.patientId;
    const responses = await this.dataSource
      .getRepository(ItemFormResponse)
      .findBy({ itemId: In(source.items.map((i) => i.id)) });
    const answersOf = new Map(responses.map((r) => [r.itemId, r]));
    const defs = await this.definitions(
      this.dataSource.manager,
      responses.map((r) => r.formSchemaVersionId),
    );

    const items: OrderItemDto[] = source.items
      .filter((i) => i.statusCode !== 'cancelled')
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((i) => {
        const r = answersOf.get(i.id);
        const def = r?.formSchemaVersionId
          ? defs.get(r.formSchemaVersionId)
          : null;
        const answers = { ...(r?.data ?? {}) };
        for (const f of def?.fields ?? []) {
          if (f.type === 'file' || (f.type === 'tooth_chart' && !samePatient)) {
            delete answers[f.key];
          }
        }
        return {
          labServiceId: i.labServiceId,
          optionIds: i.optionIds,
          quantity: i.quantity,
          rush: i.rush,
          clinicTreatmentId: i.clinicTreatmentId,
          answers,
        };
      });
    return this.create(
      c,
      {
        patientId,
        labId: source.labId,
        doctorId:
          c.actor.employeeId && c.actor.roles.includes(AppRole.DOCTOR)
            ? c.actor.employeeId
            : source.doctorId,
        priority: source.priority,
        notes: source.notes,
        items,
      },
      null,
    );
  }

  // ── helpers ───────────────────────────────────────────────────────────

  /**
   * Upserts the draft's lines: kept ids are updated (re-pinned only if the
   * service changed), new lines pinned now, missing lines removed — drafts
   * aren't clinical records yet, so their lines may go.
   */
  private async writeItems(
    m: EntityManager,
    c: ClinicCall,
    order: LabOrder,
    items: OrderItemDto[],
    services: Map<string, LabService>,
    existing: LabOrderItem[],
  ): Promise<void> {
    const org = order.organizationId;
    const byId = new Map(existing.map((i) => [i.id, i]));
    const kept = new Set(
      items
        .filter((i) => i.id && byId.get(i.id)?.labServiceId === i.labServiceId)
        .map((i) => i.id!),
    );
    const removed = existing.filter((i) => !kept.has(i.id)).map((i) => i.id);
    if (removed.length) {
      await m.delete(ItemFormResponse, { itemId: In(removed) });
      await m.delete(LabOrderItem, { id: In(removed) });
    }
    if (kept.size) {
      // Free the line numbers before re-numbering (unique per order).
      await m.query(
        `UPDATE lab_order_items SET line_no = line_no + 10000 WHERE order_id = $1`,
        [order.id],
      );
    }

    const pins = new Map<string, Awaited<ReturnType<typeof this.pin>>>();
    const repo = m.getRepository(LabOrderItem);
    for (const [index, dto] of items.entries()) {
      const service = services.get(dto.labServiceId)!;
      await this.assertOptions(m, service.id, dto.optionIds ?? []);
      let item = dto.id && kept.has(dto.id) ? byId.get(dto.id)! : null;
      if (!item) {
        const pin = pins.get(service.id) ?? (await this.pin(m, org, service));
        pins.set(service.id, pin);
        item = repo.create({
          organizationId: org,
          orderId: order.id,
          labServiceId: service.id,
          formSchemaVersionId: pin.formVersionId,
          workflowTemplateVersionId: pin.workflowVersionId,
          stageTemplateId: service.stageTemplateId,
          statusCode: null,
          createdBy: c.actor.userId,
        });
      }
      item.lineNo = index + 1;
      item.optionIds = dto.optionIds ?? [];
      item.quantity = dto.quantity ?? 1;
      item.rush = dto.rush ?? false;
      item.clinicTreatmentId = dto.clinicTreatmentId ?? null;
      item.updatedBy = c.actor.userId;
      item = await repo.save(item);

      await m.getRepository(ItemFormResponse).save({
        itemId: item.id,
        organizationId: org,
        formSchemaVersionId: item.formSchemaVersionId,
        data: dto.answers ?? {},
        validatedAt: null,
      });
    }
  }

  /** The versions a new line pins: its form (by code, org override wins) and item workflow. */
  private async pin(
    m: EntityManager,
    organizationId: string,
    service: LabService,
  ): Promise<{ formVersionId: string | null; workflowVersionId: string }> {
    let formVersionId: string | null = null;
    if (service.formSchemaId) {
      const [form] = await sqlRows<{ code: string; specialty_code: string }>(
        m,
        `SELECT fs.code, sp.code AS specialty_code
           FROM form_schemas fs JOIN specialties sp ON sp.id = fs.specialty_id
          WHERE fs.id = $1`,
        [service.formSchemaId],
      );
      const current = await this.forms.current(
        organizationId,
        form.specialty_code,
        m,
      );
      const hit = current.find((f) => f.code === form.code);
      if (!hit) {
        throw orderError(
          'LAB_ORDER_INVALID',
          `The form for ${service.name} is not available`,
        );
      }
      formVersionId = hit.versionId;
    }
    return {
      formVersionId,
      workflowVersionId: await this.workflow.pinWorkflowVersion(
        m,
        organizationId,
        service.specialtyId,
        'item',
        service.workflowTemplateId,
      ),
    };
  }

  private async definitions(
    m: EntityManager,
    ids: (string | null)[],
  ): Promise<Map<string, FormDefinition>> {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    if (!wanted.length) return new Map();
    const rows = await m
      .getRepository(FormSchemaVersion)
      .findBy({ id: In(wanted) });
    return new Map(rows.map((v) => [v.id, v.schemaJson]));
  }

  private async services(
    m: EntityManager,
    labId: string,
    items: OrderItemDto[],
  ): Promise<Map<string, LabService>> {
    const ids = [...new Set(items.map((i) => i.labServiceId))];
    const rows = await m.getRepository(LabService).findBy({ id: In(ids) });
    const byId = new Map(rows.map((s) => [s.id, s]));
    for (const id of ids) {
      const s = byId.get(id);
      if (!s || s.labId !== labId) {
        throw orderError(
          'LAB_ORDER_LAB_MISMATCH',
          'Every line must be a service of the chosen lab',
        );
      }
      if (!s.isActive) {
        throw catalogError(
          'LAB_SERVICE_INACTIVE',
          `${s.name} is no longer offered by this lab`,
        );
      }
    }
    return byId;
  }

  private oneSpecialty(services: Map<string, LabService>): string {
    const specialties = new Set(
      [...services.values()].map((s) => s.specialtyId),
    );
    if (specialties.size !== 1) {
      throw orderError(
        'LAB_ORDER_INVALID',
        'An order’s lines must all be of one specialty',
      );
    }
    return [...specialties][0];
  }

  private async assertOptions(
    m: EntityManager,
    serviceId: string,
    optionIds: string[],
  ): Promise<void> {
    if (!optionIds.length) return;
    const count = await m.getRepository(LabServiceOption).countBy({
      id: In(optionIds),
      labServiceId: serviceId,
      isActive: true,
    });
    if (count !== optionIds.length) {
      throw catalogError(
        'LAB_SERVICE_OPTION_NOT_FOUND',
        'One of the chosen options is not offered for this service',
      );
    }
  }

  private async activeLink(
    m: EntityManager,
    organizationId: string,
    labId: string,
  ): Promise<LabClinicLink> {
    const link = await m
      .getRepository(LabClinicLink)
      .findOneBy({ organizationId, labId });
    if (!link) throw catalogError('LAB_NOT_FOUND', 'Lab not found');
    if (link.status !== LabLinkStatus.ACTIVE) {
      throw catalogError(
        'LAB_NOT_LINKED',
        'Activate this lab in your lab list before ordering from it',
      );
    }
    return link;
  }

  private async assertPatient(
    m: EntityManager,
    organizationId: string,
    patientId: string,
  ): Promise<void> {
    const [row] = await sqlRows<{ id: string }>(
      m,
      `SELECT id FROM patients WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [patientId, organizationId],
    );
    if (!row) {
      throw orderError('LAB_ORDER_PATIENT_NOT_FOUND', 'Patient not found');
    }
  }

  private async assertAppointment(
    m: EntityManager,
    organizationId: string,
    patientId: string,
    appointmentId: string | null | undefined,
  ): Promise<void> {
    if (!appointmentId) return;
    const [row] = await sqlRows<{ id: string }>(
      m,
      `SELECT id FROM appointments WHERE id = $1 AND organization_id = $2 AND patient_id = $3`,
      [appointmentId, organizationId, patientId],
    );
    if (!row) {
      throw orderError(
        'LAB_ORDER_INVALID',
        'Appointment not found for this patient',
      );
    }
  }

  /** The given doctor (an employee of this clinic), else the caller if they are a doctor. */
  private async doctorFor(
    m: EntityManager,
    c: ClinicCall,
    doctorId: string | null | undefined,
  ): Promise<string | null> {
    if (!doctorId) {
      return c.actor.roles.includes(AppRole.DOCTOR) ? c.actor.employeeId : null;
    }
    const [row] = await sqlRows<{ employee_id: string }>(
      m,
      `SELECT employee_id FROM employee_org_location_assignments
        WHERE employee_id = $1 AND organization_id = $2 LIMIT 1`,
      [doctorId, c.tenant.organizationId],
    );
    if (!row) {
      throw orderError('LAB_ORDER_DOCTOR_NOT_FOUND', 'Doctor not found');
    }
    return doctorId;
  }

  private async lockDraft(
    m: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<LabOrder> {
    const order = await m.getRepository(LabOrder).findOne({
      where: { id, organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) throw orderError('LAB_ORDER_NOT_FOUND', 'Order not found');
    if (order.statusCode !== DRAFT) {
      throw orderError(
        'LAB_ORDER_NOT_DRAFT',
        'Only drafts can be edited; change a submitted order with a revision',
      );
    }
    return order;
  }

  private async byKey(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<string | null> {
    const row = await this.dataSource
      .getRepository(LabOrder)
      .findOne({ where: { organizationId, idempotencyKey }, select: ['id'] });
    return row?.id ?? null;
  }

  private headerSnapshot(o: LabOrder) {
    return {
      doctorId: o.doctorId,
      priority: o.priority,
      requestedOn: o.requestedOn,
      appointmentId: o.appointmentId,
      treatmentId: o.treatmentId,
      notes: o.notes,
    };
  }
}
