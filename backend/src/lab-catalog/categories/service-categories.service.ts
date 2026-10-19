import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { Specialty } from 'src/engine/entities/specialty.entity';
import { mapConstraintErrors } from '../common/catalog-db';
import { catalogError } from '../common/catalog-errors';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from '../dto/catalog.dto';
import { ServiceCategory } from '../entities/service-category.entity';
import { CATALOG_ENTITY } from '../enums/catalog.enums';
import {
  CATEGORY_AUDIT_FIELDS,
  CategoryResponse,
  toCategoryResponse,
} from '../mappers/catalog-response';

const UNIQUE = {
  uq_service_categories_code: [
    'SERVICE_CATEGORY_EXISTS',
    'A category with this code already exists for the specialty',
  ],
} as const;

/** Platform service categories (CROWN, BRIDGE …), per specialty. */
@Injectable()
export class ServiceCategoriesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListCategoriesQueryDto): Promise<CategoryResponse[]> {
    const qb = this.dataSource
      .getRepository(ServiceCategory)
      .createQueryBuilder('c')
      .orderBy('c.sortOrder', 'ASC')
      .addOrderBy('c.name', 'ASC');
    if (q.specialtyId) {
      qb.andWhere('c.specialty_id = :specialtyId', {
        specialtyId: q.specialtyId,
      });
    }
    if (!q.includeInactive) qb.andWhere('c.is_active');
    const rows = await qb.getMany();
    const counts = await this.serviceCounts(rows.map((r) => r.id));
    return rows.map((r) => toCategoryResponse(r, counts.get(r.id) ?? 0));
  }

  async create(
    dto: CreateCategoryDto,
    actor: ActorRef,
  ): Promise<CategoryResponse> {
    return this.dataSource.transaction(async (m) => {
      const specialty = await m
        .getRepository(Specialty)
        .findOneBy({ id: dto.specialtyId });
      if (!specialty) {
        throw catalogError('SPECIALTY_NOT_FOUND', 'Specialty not found');
      }
      const row = await this.createInTx(m, actor, {
        specialtyId: specialty.id,
        code: dto.code,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
      });
      return toCategoryResponse(row);
    });
  }

  /** Insert + audit in the caller's transaction (also used by the seed). */
  async createInTx(
    m: EntityManager,
    actor: ActorRef,
    input: Pick<ServiceCategory, 'specialtyId' | 'code' | 'name' | 'sortOrder'>,
  ): Promise<ServiceCategory> {
    const repo = m.getRepository(ServiceCategory);
    const row = await mapConstraintErrors(
      () =>
        repo.save(
          repo.create({
            ...input,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          }),
        ),
      UNIQUE,
    );
    await this.audit.record(m, actor, {
      organizationId: null,
      entityType: CATALOG_ENTITY.SERVICE_CATEGORY,
      entityId: row.id,
      action: AuditAction.CREATE,
      after: snapshotOf(row, CATEGORY_AUDIT_FIELDS),
    });
    return row;
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    actor: ActorRef,
  ): Promise<CategoryResponse> {
    return this.dataSource.transaction(async (m) => {
      const row = await m.getRepository(ServiceCategory).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw catalogError('SERVICE_CATEGORY_NOT_FOUND', 'Category not found');
      }
      assertVersion(row.version, dto.version);
      const before = snapshotOf(row, CATEGORY_AUDIT_FIELDS);
      if (dto.name !== undefined) row.name = dto.name;
      if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
      if (dto.isActive !== undefined) row.isActive = dto.isActive;
      const changed = await this.audit.record(m, actor, {
        organizationId: null,
        entityType: CATALOG_ENTITY.SERVICE_CATEGORY,
        entityId: row.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(row, CATEGORY_AUDIT_FIELDS),
      });
      if (changed) {
        row.updatedBy = actor.userId;
        await m.getRepository(ServiceCategory).save(row);
      }
      const counts = await this.serviceCounts([row.id], m);
      return toCategoryResponse(row, counts.get(row.id) ?? 0);
    });
  }

  private async serviceCounts(
    ids: string[],
    m: EntityManager = this.dataSource.manager,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!ids.length) return out;
    const rows = await sqlRows<{ category_id: string; n: string }>(
      m,
      `SELECT category_id, count(*) AS n FROM lab_services
        WHERE category_id = ANY($1::uuid[]) AND is_active
        GROUP BY category_id`,
      [ids],
    );
    for (const r of rows) out.set(r.category_id, Number(r.n));
    return out;
  }
}
