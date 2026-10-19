import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, IsNull } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService, TimelineEntry } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { FormSchema } from 'src/engine/entities/form-schema.entity';
import { StageTemplate } from 'src/engine/entities/stage-template.entity';
import { WorkflowTemplate } from 'src/engine/entities/workflow-template.entity';
import { likePattern } from 'src/labs/common/lab-query';
import { Lab } from 'src/labs/entities/lab.entity';
import { mapConstraintErrors } from '../common/catalog-db';
import { catalogError } from '../common/catalog-errors';
import {
  CreateLabServiceDto,
  CreateOptionDto,
  ListLabServicesQueryDto,
  UpdateLabServiceDto,
  UpdateOptionDto,
} from '../dto/catalog.dto';
import { LabServiceOption } from '../entities/lab-service-option.entity';
import { LabServicePrice } from '../entities/lab-service-price.entity';
import { LabService } from '../entities/lab-service.entity';
import { ServiceCategory } from '../entities/service-category.entity';
import { CATALOG_ENTITY, LabPriceSource } from '../enums/catalog.enums';
import { CATALOG_TIMEZONE } from '../lab-catalog.constants';
import {
  LabServiceResponse,
  OPTION_AUDIT_FIELDS,
  OptionResponse,
  PlatformServiceRow,
  SERVICE_AUDIT_FIELDS,
  toEffectivePrice,
  toOptionResponse,
  toServiceResponse,
} from '../mappers/catalog-response';
import { isActiveOn } from '../pricing/price-resolver';

const SERVICE_UNIQUE = {
  uq_lab_services_lab_code: [
    'LAB_SERVICE_EXISTS',
    'This lab already has a service with this code',
  ],
} as const;
const OPTION_UNIQUE = {
  uq_lab_service_options_code: [
    'LAB_SERVICE_OPTION_EXISTS',
    'This service already has an option with this code',
  ],
} as const;

/** Relations every service response needs. */
export const SERVICE_RELATIONS = {
  specialty: true,
  category: true,
  formSchema: true,
  workflowTemplate: true,
  stageTemplate: true,
} as const;

/**
 * A lab's own catalog: services and their options. Every method is scoped
 * by `labId`, so the platform routes (super admin) and, later, the lab
 * portal (lab_admin of that lab) call the same code — the caller decides
 * which lab the user may act for.
 */
@Injectable()
export class LabServicesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  today(): string {
    return this.clock.today(CATALOG_TIMEZONE);
  }

  async list(
    labId: string,
    q: ListLabServicesQueryDto,
  ): Promise<PaginatedResponseDto<PlatformServiceRow>> {
    await this.assertLab(this.dataSource.manager, labId);
    const qb = this.dataSource
      .getRepository(LabService)
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.specialty', 'specialty')
      .innerJoinAndSelect('s.category', 'category')
      .leftJoinAndSelect('s.formSchema', 'formSchema')
      .leftJoinAndSelect('s.workflowTemplate', 'workflowTemplate')
      .leftJoinAndSelect('s.stageTemplate', 'stageTemplate')
      .where('s.lab_id = :labId', { labId })
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('s.name', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.categoryId) {
      qb.andWhere('s.category_id = :categoryId', { categoryId: q.categoryId });
    }
    if (q.isActive !== undefined) {
      qb.andWhere('s.is_active = :isActive', { isActive: q.isActive });
    }
    if (q.search) {
      const term = likePattern(q.search);
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('s.name ILIKE :term', { term })
            .orWhere('s.code ILIKE :term', { term }),
        ),
      );
    }
    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((r) => r.id);
    const options = await this.optionsFor(this.dataSource.manager, ids);
    const today = this.today();
    const prices = ids.length
      ? await this.dataSource.getRepository(LabServicePrice).find({
          where: { labServiceId: In(ids), voidedAt: IsNull() },
        })
      : [];
    const negotiated = await this.negotiatedCounts(ids, today);

    return PaginatedResponseDto.create(
      rows.map((s) => {
        const list = prices.find(
          (p) =>
            p.labServiceId === s.id &&
            p.organizationId === null &&
            isActiveOn(p, today),
        );
        return {
          ...toServiceResponse(s, options.get(s.id) ?? []),
          listPrice: list ? toEffectivePrice(list, LabPriceSource.LIST) : null,
          negotiatedPriceCount: negotiated.get(s.id) ?? 0,
        };
      }),
      total,
      q.page,
      q.limit,
    );
  }

  async get(labId: string, id: string): Promise<LabServiceResponse> {
    const m = this.dataSource.manager;
    const service = await this.findService(m, labId, id);
    const options = await this.optionsFor(m, [service.id]);
    return toServiceResponse(service, options.get(service.id) ?? []);
  }

  async create(
    labId: string,
    dto: CreateLabServiceDto,
    actor: ActorRef,
  ): Promise<LabServiceResponse> {
    return this.dataSource.transaction(async (m) => {
      await this.assertLab(m, labId);
      const category = await this.activeCategory(m, dto.categoryId);
      await this.assertDefinitions(m, category.specialtyId, dto);
      const repo = m.getRepository(LabService);
      const service = await mapConstraintErrors(
        () =>
          repo.save(
            repo.create({
              labId,
              specialtyId: category.specialtyId,
              categoryId: category.id,
              code: dto.code,
              name: dto.name,
              description: dto.description ?? null,
              unitType: dto.unitType,
              defaultTurnaroundDays: dto.defaultTurnaroundDays ?? 7,
              formSchemaId: dto.formSchemaId ?? null,
              workflowTemplateId: dto.workflowTemplateId ?? null,
              stageTemplateId: dto.stageTemplateId ?? null,
              createdBy: actor.userId,
              updatedBy: actor.userId,
            }),
          ),
        SERVICE_UNIQUE,
      );
      await this.audit.record(m, actor, {
        organizationId: null,
        entityType: CATALOG_ENTITY.LAB_SERVICE,
        entityId: service.id,
        action: AuditAction.CREATE,
        after: snapshotOf(service, SERVICE_AUDIT_FIELDS),
      });
      return toServiceResponse(await this.findService(m, labId, service.id));
    });
  }

  async update(
    labId: string,
    id: string,
    dto: UpdateLabServiceDto,
    actor: ActorRef,
  ): Promise<LabServiceResponse> {
    return this.dataSource.transaction(async (m) => {
      const service = await this.lockService(m, labId, id);
      assertVersion(service.version, dto.version);
      const before = snapshotOf(service, SERVICE_AUDIT_FIELDS);

      if (
        dto.categoryId !== undefined &&
        dto.categoryId !== service.categoryId
      ) {
        const category = await this.activeCategory(m, dto.categoryId);
        if (category.specialtyId !== service.specialtyId) {
          throw catalogError(
            'SERVICE_CATEGORY_MISMATCH',
            'Pick a category of the same specialty',
          );
        }
        service.categoryId = category.id;
      }
      await this.assertDefinitions(m, service.specialtyId, dto);
      if (dto.name !== undefined) service.name = dto.name;
      if (dto.description !== undefined) service.description = dto.description;
      if (dto.unitType !== undefined) service.unitType = dto.unitType;
      if (dto.defaultTurnaroundDays !== undefined)
        service.defaultTurnaroundDays = dto.defaultTurnaroundDays;
      if (dto.formSchemaId !== undefined)
        service.formSchemaId = dto.formSchemaId;
      if (dto.workflowTemplateId !== undefined)
        service.workflowTemplateId = dto.workflowTemplateId;
      if (dto.stageTemplateId !== undefined)
        service.stageTemplateId = dto.stageTemplateId;
      if (dto.isActive !== undefined) service.isActive = dto.isActive;

      const changed = await this.audit.record(m, actor, {
        organizationId: null,
        entityType: CATALOG_ENTITY.LAB_SERVICE,
        entityId: service.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(service, SERVICE_AUDIT_FIELDS),
      });
      if (changed) {
        service.updatedBy = actor.userId;
        // Relations were not loaded by the lock; save the columns only.
        await m.getRepository(LabService).save(service);
      }
      const options = await this.optionsFor(m, [service.id]);
      return toServiceResponse(
        await this.findService(m, labId, service.id),
        options.get(service.id) ?? [],
      );
    });
  }

  async addOption(
    labId: string,
    serviceId: string,
    dto: CreateOptionDto,
    actor: ActorRef,
  ): Promise<OptionResponse> {
    return this.dataSource.transaction(async (m) => {
      const service = await this.lockService(m, labId, serviceId);
      const repo = m.getRepository(LabServiceOption);
      const option = await mapConstraintErrors(
        () =>
          repo.save(
            repo.create({
              labServiceId: service.id,
              optionType: dto.optionType,
              code: dto.code,
              name: dto.name,
              extraCostPaisa: dto.extraCostPaisa,
              sortOrder: dto.sortOrder ?? 0,
              createdBy: actor.userId,
              updatedBy: actor.userId,
            }),
          ),
        OPTION_UNIQUE,
      );
      await this.audit.record(m, actor, {
        organizationId: null,
        entityType: CATALOG_ENTITY.LAB_SERVICE_OPTION,
        entityId: option.id,
        action: AuditAction.CREATE,
        after: snapshotOf(option, OPTION_AUDIT_FIELDS),
      });
      return toOptionResponse(option);
    });
  }

  async updateOption(
    labId: string,
    serviceId: string,
    optionId: string,
    dto: UpdateOptionDto,
    actor: ActorRef,
  ): Promise<OptionResponse> {
    return this.dataSource.transaction(async (m) => {
      await this.lockService(m, labId, serviceId);
      const option = await m.getRepository(LabServiceOption).findOne({
        where: { id: optionId, labServiceId: serviceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!option) {
        throw catalogError('LAB_SERVICE_OPTION_NOT_FOUND', 'Option not found');
      }
      assertVersion(option.version, dto.version);
      const before = snapshotOf(option, OPTION_AUDIT_FIELDS);
      if (dto.name !== undefined) option.name = dto.name;
      if (dto.extraCostPaisa !== undefined)
        option.extraCostPaisa = dto.extraCostPaisa;
      if (dto.sortOrder !== undefined) option.sortOrder = dto.sortOrder;
      if (dto.isActive !== undefined) option.isActive = dto.isActive;
      const changed = await this.audit.record(m, actor, {
        organizationId: null,
        entityType: CATALOG_ENTITY.LAB_SERVICE_OPTION,
        entityId: option.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(option, OPTION_AUDIT_FIELDS),
      });
      if (changed) {
        option.updatedBy = actor.userId;
        await m.getRepository(LabServiceOption).save(option);
      }
      return toOptionResponse(option);
    });
  }

  async history(labId: string, id: string): Promise<TimelineEntry[]> {
    const m = this.dataSource.manager;
    await this.findService(m, labId, id);
    return this.audit.timeline(m, CATALOG_ENTITY.LAB_SERVICE, id, null);
  }

  // ── helpers (also used by the price and clinic services) ─────────────

  async assertLab(m: EntityManager, labId: string): Promise<Lab> {
    const lab = await m.getRepository(Lab).findOneBy({ id: labId });
    if (!lab) throw catalogError('LAB_NOT_FOUND', 'Lab not found');
    return lab;
  }

  async findService(
    m: EntityManager,
    labId: string,
    id: string,
  ): Promise<LabService> {
    const service = await m.getRepository(LabService).findOne({
      where: { id, labId },
      relations: SERVICE_RELATIONS,
    });
    if (!service)
      throw catalogError('LAB_SERVICE_NOT_FOUND', 'Service not found');
    return service;
  }

  /** Row-locks the service (serialises its option and price writes). */
  async lockService(
    m: EntityManager,
    labId: string,
    id: string,
  ): Promise<LabService> {
    const service = await m.getRepository(LabService).findOne({
      where: { id, labId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!service)
      throw catalogError('LAB_SERVICE_NOT_FOUND', 'Service not found');
    return service;
  }

  async optionsFor(
    m: EntityManager,
    serviceIds: string[],
  ): Promise<Map<string, LabServiceOption[]>> {
    const out = new Map<string, LabServiceOption[]>();
    if (!serviceIds.length) return out;
    const rows = await m
      .getRepository(LabServiceOption)
      .findBy({ labServiceId: In(serviceIds) });
    for (const o of rows) {
      const list = out.get(o.labServiceId) ?? [];
      list.push(o);
      out.set(o.labServiceId, list);
    }
    return out;
  }

  private async activeCategory(
    m: EntityManager,
    id: string,
  ): Promise<ServiceCategory> {
    const category = await m.getRepository(ServiceCategory).findOneBy({ id });
    if (!category || !category.isActive) {
      throw catalogError('SERVICE_CATEGORY_NOT_FOUND', 'Category not found');
    }
    return category;
  }

  /**
   * The form, item workflow and stage template must be active platform
   * definitions of the service's specialty — a lab serves every clinic, so
   * it cannot point at one clinic's own definitions.
   */
  private async assertDefinitions(
    m: EntityManager,
    specialtyId: string,
    dto: Pick<
      CreateLabServiceDto,
      'formSchemaId' | 'workflowTemplateId' | 'stageTemplateId'
    >,
  ): Promise<void> {
    const bad = (what: string) =>
      catalogError(
        'LAB_SERVICE_DEFINITION_INVALID',
        `Pick an active platform ${what} of the same specialty`,
      );
    const platform = { specialtyId, organizationId: IsNull(), isActive: true };
    if (dto.formSchemaId) {
      const ok = await m
        .getRepository(FormSchema)
        .existsBy({ id: dto.formSchemaId, ...platform });
      if (!ok) throw bad('form');
    }
    if (dto.workflowTemplateId) {
      const ok = await m.getRepository(WorkflowTemplate).existsBy({
        id: dto.workflowTemplateId,
        entityType: 'item',
        ...platform,
      });
      if (!ok) throw bad('item workflow');
    }
    if (dto.stageTemplateId) {
      const ok = await m
        .getRepository(StageTemplate)
        .existsBy({ id: dto.stageTemplateId, ...platform });
      if (!ok) throw bad('stage template');
    }
  }

  /** Clinics with a negotiated price active today, per service. */
  private async negotiatedCounts(
    ids: string[],
    today: string,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!ids.length) return out;
    const rows = await sqlRows<{ lab_service_id: string; n: string }>(
      this.dataSource.manager,
      `SELECT lab_service_id, count(DISTINCT organization_id) AS n
         FROM lab_service_prices
        WHERE lab_service_id = ANY($1::uuid[])
          AND organization_id IS NOT NULL AND voided_at IS NULL
          AND effective_from <= $2::date
          AND (effective_to IS NULL OR effective_to >= $2::date)
        GROUP BY lab_service_id`,
      [ids, today],
    );
    for (const r of rows) out.set(r.lab_service_id, Number(r.n));
    return out;
  }
}
