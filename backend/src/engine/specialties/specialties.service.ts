import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { Organization } from 'src/organizations/entities/organization.entity';
import { engineError } from '../common/engine-errors';
import { CreateSpecialtyDto, UpdateSpecialtyDto } from '../dto/engine.dto';
import { OrganizationSpecialty } from '../entities/organization-specialty.entity';
import { Specialty } from '../entities/specialty.entity';
import { ENGINE_ENTITY } from '../enums/engine.enums';

const AUDIT_FIELDS = [
  'code',
  'name',
  'isActive',
  'enabledByDefault',
] as const satisfies readonly (keyof Specialty)[];

export interface SpecialtyResponse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  enabledByDefault: boolean;
  version: number;
}

export interface OrganizationSpecialtyResponse {
  organization: { id: string; name: string };
  isEnabled: boolean;
}

const toResponse = (s: Specialty): SpecialtyResponse => ({
  id: s.id,
  code: s.code,
  name: s.name,
  isActive: s.isActive,
  enabledByDefault: s.enabledByDefault,
  version: s.version,
});

/**
 * Specialties (platform) and which of them each organization works in.
 * An organization's rows are created lazily from `enabled_by_default`, so
 * new organizations need no setup step and a super admin's later choice
 * (on or off) always wins.
 */
@Injectable()
export class SpecialtiesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<SpecialtyResponse[]> {
    const rows = await this.dataSource
      .getRepository(Specialty)
      .find({ order: { name: 'ASC' } });
    return rows.map(toResponse);
  }

  async create(
    dto: CreateSpecialtyDto,
    actor: ActorRef,
  ): Promise<SpecialtyResponse> {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(Specialty);
      if (await repo.existsBy({ code: dto.code })) {
        throw engineError('SPECIALTY_EXISTS', `Specialty ${dto.code} exists`);
      }
      const specialty = await repo.save(
        repo.create({
          code: dto.code,
          name: dto.name,
          enabledByDefault: dto.enabledByDefault ?? false,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        }),
      );
      await this.audit.record(m, actor, {
        organizationId: null,
        entityType: ENGINE_ENTITY.SPECIALTY,
        entityId: specialty.id,
        action: AuditAction.CREATE,
        after: snapshotOf(specialty, AUDIT_FIELDS),
      });
      return toResponse(specialty);
    });
  }

  async update(
    id: string,
    dto: UpdateSpecialtyDto,
    actor: ActorRef,
  ): Promise<SpecialtyResponse> {
    return this.dataSource.transaction(async (m) => {
      const specialty = await m.getRepository(Specialty).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!specialty) {
        throw engineError('SPECIALTY_NOT_FOUND', 'Specialty not found');
      }
      assertVersion(specialty.version, dto.version);
      const before = snapshotOf(specialty, AUDIT_FIELDS);
      if (dto.name !== undefined) specialty.name = dto.name;
      if (dto.isActive !== undefined) specialty.isActive = dto.isActive;
      if (dto.enabledByDefault !== undefined)
        specialty.enabledByDefault = dto.enabledByDefault;
      const changed = await this.audit.record(m, actor, {
        organizationId: null,
        entityType: ENGINE_ENTITY.SPECIALTY,
        entityId: id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(specialty, AUDIT_FIELDS),
      });
      if (changed) {
        specialty.updatedBy = actor.userId;
        await m.getRepository(Specialty).save(specialty);
      }
      return toResponse(specialty);
    });
  }

  /** Every organization with whether it works in this specialty. */
  async organizations(
    specialtyId: string,
  ): Promise<OrganizationSpecialtyResponse[]> {
    const specialty = await this.find(this.dataSource.manager, specialtyId);
    const rows = await sqlRows<{
      id: string;
      name: string;
      is_enabled: boolean | null;
    }>(
      this.dataSource.manager,
      `SELECT o.id, o.name, os.is_enabled
         FROM organizations o
         LEFT JOIN organization_specialties os
           ON os.organization_id = o.id AND os.specialty_id = $1
        ORDER BY o.name`,
      [specialtyId],
    );
    return rows.map((r) => ({
      organization: { id: r.id, name: r.name },
      isEnabled: r.is_enabled ?? specialty.enabledByDefault,
    }));
  }

  async setForOrganization(
    specialtyId: string,
    organizationId: string,
    isEnabled: boolean,
    actor: ActorRef,
  ): Promise<OrganizationSpecialtyResponse> {
    return this.dataSource.transaction(async (m) => {
      await this.find(m, specialtyId);
      const org = await m
        .getRepository(Organization)
        .findOneBy({ id: organizationId });
      if (!org) {
        throw engineError('ORGANIZATION_NOT_FOUND', 'Organization not found');
      }
      await this.ensureDefaults(m, organizationId);
      const repo = m.getRepository(OrganizationSpecialty);
      const row = await repo.findOneOrFail({
        where: { organizationId, specialtyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (row.isEnabled !== isEnabled) {
        await this.audit.record(m, actor, {
          organizationId,
          entityType: ENGINE_ENTITY.ORGANIZATION_SPECIALTY,
          entityId: specialtyId,
          action: AuditAction.UPDATE,
          before: { isEnabled: row.isEnabled },
          after: { isEnabled },
        });
        row.isEnabled = isEnabled;
        row.updatedBy = actor.userId;
        await repo.save(row);
      }
      return { organization: { id: org.id, name: org.name }, isEnabled };
    });
  }

  /** Active specialties the organization works in. */
  async enabledFor(
    organizationId: string,
    m: EntityManager = this.dataSource.manager,
  ): Promise<SpecialtyResponse[]> {
    await this.ensureDefaults(m, organizationId);
    const rows = await m
      .getRepository(Specialty)
      .createQueryBuilder('s')
      .innerJoin(
        OrganizationSpecialty,
        'os',
        'os.specialty_id = s.id AND os.organization_id = :organizationId AND os.is_enabled',
        { organizationId },
      )
      .where('s.is_active')
      .orderBy('s.name', 'ASC')
      .getMany();
    return rows.map(toResponse);
  }

  /** Throws SPECIALTY_NOT_ENABLED unless the organization works in `code`. */
  async assertEnabled(
    organizationId: string,
    code: string,
    m: EntityManager = this.dataSource.manager,
  ): Promise<SpecialtyResponse> {
    const specialty = (await this.enabledFor(organizationId, m)).find(
      (s) => s.code === code,
    );
    if (!specialty) {
      throw engineError(
        'SPECIALTY_NOT_ENABLED',
        `${code} is not enabled for this organization`,
      );
    }
    return specialty;
  }

  /** One row per specialty for the organization, from the defaults. Idempotent. */
  private async ensureDefaults(
    m: EntityManager,
    organizationId: string,
  ): Promise<void> {
    await m.query(
      `INSERT INTO organization_specialties (organization_id, specialty_id, is_enabled)
       SELECT $1, s.id, s.enabled_by_default FROM specialties s
       ON CONFLICT (organization_id, specialty_id) DO NOTHING`,
      [organizationId],
    );
  }

  private async find(m: EntityManager, id: string): Promise<Specialty> {
    const specialty = await m.getRepository(Specialty).findOneBy({ id });
    if (!specialty) {
      throw engineError('SPECIALTY_NOT_FOUND', 'Specialty not found');
    }
    return specialty;
  }
}
