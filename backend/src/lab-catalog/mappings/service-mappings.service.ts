import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { toPaisa } from 'src/billing/common/money';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService } from 'src/common/audit/audit.service';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import { LabLinkStatus } from 'src/labs/enums/lab.enums';
import { mapConstraintErrors } from '../common/catalog-db';
import { catalogError } from '../common/catalog-errors';
import {
  CreateMappingDto,
  ListMappingsQueryDto,
  UpdateMappingDto,
} from '../dto/catalog.dto';
import { LabService } from '../entities/lab-service.entity';
import { ServiceMapping } from '../entities/service-mapping.entity';
import { CATALOG_ENTITY } from '../enums/catalog.enums';
import {
  MAPPING_AUDIT_FIELDS,
  MappingResponse,
} from '../mappers/catalog-response';

const UNIQUE = {
  uq_service_mappings_pair: [
    'SERVICE_MAPPING_EXISTS',
    'This lab service is already mapped to this treatment',
  ],
  uq_service_mappings_lab_service: [
    'LAB_SERVICE_ALREADY_MAPPED',
    'This lab service is already billed as another treatment',
  ],
} as const;

/**
 * Clinic treatment ↔ lab service (lab ERD §4). Tenant-scoped: every read
 * and write filters by the caller's organization. Writes lock the
 * treatment row, so "one default per treatment" never races.
 */
@Injectable()
export class ServiceMappingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(
    organizationId: string,
    q: ListMappingsQueryDto,
  ): Promise<MappingResponse[]> {
    const qb = this.dataSource
      .getRepository(ServiceMapping)
      .createQueryBuilder('sm')
      .innerJoinAndSelect('sm.clinicTreatment', 't')
      .innerJoinAndSelect('sm.labService', 's')
      .innerJoinAndSelect('s.lab', 'lab')
      .where('sm.organization_id = :organizationId', { organizationId })
      .orderBy('t.name', 'ASC')
      .addOrderBy('sm.isDefault', 'DESC')
      .addOrderBy('lab.name', 'ASC')
      .addOrderBy('s.name', 'ASC');
    if (!q.includeInactive) qb.andWhere('sm.is_active');
    if (q.clinicTreatmentId) {
      qb.andWhere('sm.clinic_treatment_id = :t', { t: q.clinicTreatmentId });
    }
    if (q.labId) qb.andWhere('s.lab_id = :labId', { labId: q.labId });
    return (await qb.getMany()).map(toMappingResponse);
  }

  async create(
    organizationId: string,
    dto: CreateMappingDto,
    actor: ActorRef,
  ): Promise<MappingResponse> {
    return this.dataSource.transaction(async (m) => {
      const treatment = await this.lockTreatment(
        m,
        organizationId,
        dto.clinicTreatmentId,
      );
      if (!treatment.isActive) {
        throw catalogError(
          'CLINIC_TREATMENT_INACTIVE',
          `${treatment.name} is no longer offered by your clinic`,
        );
      }
      const service = await this.visibleService(
        m,
        organizationId,
        dto.labServiceId,
      );
      if (!service.isActive) {
        throw catalogError(
          'LAB_SERVICE_INACTIVE',
          `${service.name} is no longer offered by this lab`,
        );
      }
      const repo = m.getRepository(ServiceMapping);
      const hasDefault = await repo.existsBy({
        organizationId,
        clinicTreatmentId: treatment.id,
        isActive: true,
        isDefault: true,
      });
      const makeDefault = dto.isDefault === true || !hasDefault;
      if (makeDefault)
        await this.clearDefault(m, actor, organizationId, treatment.id);

      // A mapping that was removed earlier comes back instead of a duplicate.
      const existing = await repo.findOneBy({
        organizationId,
        clinicTreatmentId: treatment.id,
        labServiceId: service.id,
      });
      let mapping: ServiceMapping;
      if (existing) {
        if (existing.isActive) {
          throw catalogError(...UNIQUE.uq_service_mappings_pair);
        }
        const before = snapshotOf(existing, MAPPING_AUDIT_FIELDS);
        existing.isActive = true;
        existing.isDefault = makeDefault;
        existing.updatedBy = actor.userId;
        mapping = await mapConstraintErrors(() => repo.save(existing), UNIQUE);
        await this.audit.record(m, actor, {
          organizationId,
          entityType: CATALOG_ENTITY.SERVICE_MAPPING,
          entityId: mapping.id,
          action: AuditAction.UPDATE,
          before,
          after: snapshotOf(mapping, MAPPING_AUDIT_FIELDS),
        });
      } else {
        mapping = await mapConstraintErrors(
          () =>
            repo.save(
              repo.create({
                organizationId,
                clinicTreatmentId: treatment.id,
                labServiceId: service.id,
                isDefault: makeDefault,
                createdBy: actor.userId,
                updatedBy: actor.userId,
              }),
            ),
          UNIQUE,
        );
        await this.audit.record(m, actor, {
          organizationId,
          entityType: CATALOG_ENTITY.SERVICE_MAPPING,
          entityId: mapping.id,
          action: AuditAction.CREATE,
          after: snapshotOf(mapping, MAPPING_AUDIT_FIELDS),
        });
      }
      return toMappingResponse(await this.reload(m, mapping.id));
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateMappingDto,
    actor: ActorRef,
  ): Promise<MappingResponse> {
    return this.dataSource.transaction(async (m) => {
      const current = await m
        .getRepository(ServiceMapping)
        .findOneBy({ id, organizationId });
      if (!current) {
        throw catalogError('SERVICE_MAPPING_NOT_FOUND', 'Mapping not found');
      }
      await this.lockTreatment(m, organizationId, current.clinicTreatmentId);
      const mapping = await m.getRepository(ServiceMapping).findOneOrFail({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      assertVersion(mapping.version, dto.version);
      const before = snapshotOf(mapping, MAPPING_AUDIT_FIELDS);
      const wasDefault = mapping.isActive && mapping.isDefault;

      if (dto.isActive !== undefined) mapping.isActive = dto.isActive;
      if (dto.isDefault !== undefined) mapping.isDefault = dto.isDefault;
      if (!mapping.isActive) mapping.isDefault = false;
      if (mapping.isActive && mapping.isDefault && !wasDefault) {
        await this.clearDefault(
          m,
          actor,
          organizationId,
          mapping.clinicTreatmentId,
          mapping.id,
        );
      }

      const changed = await this.audit.record(m, actor, {
        organizationId,
        entityType: CATALOG_ENTITY.SERVICE_MAPPING,
        entityId: mapping.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(mapping, MAPPING_AUDIT_FIELDS),
      });
      if (changed) {
        mapping.updatedBy = actor.userId;
        await mapConstraintErrors(
          () => m.getRepository(ServiceMapping).save(mapping),
          UNIQUE,
        );
      }
      // The treatment keeps a default while it has any active mapping.
      if (wasDefault && !(mapping.isActive && mapping.isDefault)) {
        await this.promoteDefault(
          m,
          actor,
          organizationId,
          mapping.clinicTreatmentId,
          mapping.id,
        );
      }
      return toMappingResponse(await this.reload(m, mapping.id));
    });
  }

  private async clearDefault(
    m: EntityManager,
    actor: ActorRef,
    organizationId: string,
    clinicTreatmentId: string,
    exceptId?: string,
  ): Promise<void> {
    const repo = m.getRepository(ServiceMapping);
    const current = await repo.find({
      where: {
        organizationId,
        clinicTreatmentId,
        isActive: true,
        isDefault: true,
        ...(exceptId ? { id: Not(exceptId) } : {}),
      },
    });
    for (const row of current) {
      const before = snapshotOf(row, MAPPING_AUDIT_FIELDS);
      row.isDefault = false;
      row.updatedBy = actor.userId;
      await repo.save(row);
      await this.audit.record(m, actor, {
        organizationId,
        entityType: CATALOG_ENTITY.SERVICE_MAPPING,
        entityId: row.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(row, MAPPING_AUDIT_FIELDS),
      });
    }
  }

  private async promoteDefault(
    m: EntityManager,
    actor: ActorRef,
    organizationId: string,
    clinicTreatmentId: string,
    exceptId: string,
  ): Promise<void> {
    const repo = m.getRepository(ServiceMapping);
    const next = await repo.findOne({
      where: {
        organizationId,
        clinicTreatmentId,
        isActive: true,
        id: Not(exceptId),
      },
      order: { createdAt: 'ASC' },
    });
    if (!next || next.isDefault) return;
    const before = snapshotOf(next, MAPPING_AUDIT_FIELDS);
    next.isDefault = true;
    next.updatedBy = actor.userId;
    await repo.save(next);
    await this.audit.record(m, actor, {
      organizationId,
      entityType: CATALOG_ENTITY.SERVICE_MAPPING,
      entityId: next.id,
      action: AuditAction.UPDATE,
      before,
      after: snapshotOf(next, MAPPING_AUDIT_FIELDS),
    });
  }

  private async lockTreatment(
    m: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<CatalogService> {
    const treatment = await m.getRepository(CatalogService).findOne({
      where: { id, organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!treatment) {
      throw catalogError('CLINIC_TREATMENT_NOT_FOUND', 'Treatment not found');
    }
    return treatment;
  }

  /** A service of a lab on the clinic's list; anything else answers 404. */
  private async visibleService(
    m: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<LabService> {
    const service = await m.getRepository(LabService).findOneBy({ id });
    const linked =
      service &&
      (await m.getRepository(LabClinicLink).existsBy({
        labId: service.labId,
        organizationId,
        status: In([LabLinkStatus.ACTIVE, LabLinkStatus.INVITED]),
      }));
    if (!service || !linked) {
      throw catalogError('LAB_SERVICE_NOT_FOUND', 'Service not found');
    }
    return service;
  }

  private reload(m: EntityManager, id: string): Promise<ServiceMapping> {
    return m.getRepository(ServiceMapping).findOneOrFail({
      where: { id },
      relations: { clinicTreatment: true, labService: { lab: true } },
    });
  }
}

function toMappingResponse(sm: ServiceMapping): MappingResponse {
  return {
    id: sm.id,
    clinicTreatment: {
      id: sm.clinicTreatment.id,
      name: sm.clinicTreatment.name,
      code: sm.clinicTreatment.code,
      isActive: sm.clinicTreatment.isActive,
      defaultPricePaisa: toPaisa(sm.clinicTreatment.defaultPrice),
    },
    labService: {
      id: sm.labService.id,
      code: sm.labService.code,
      name: sm.labService.name,
      unitType: sm.labService.unitType,
      isActive: sm.labService.isActive,
      lab: { id: sm.labService.lab.id, name: sm.labService.lab.name },
    },
    isDefault: sm.isDefault,
    isActive: sm.isActive,
    version: sm.version,
    createdAt: sm.createdAt,
  };
}
