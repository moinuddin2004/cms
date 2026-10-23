import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EmploymentRole } from './entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from './entities/employee-org-location-assignment.entity';
import { CreateEmploymentRoleDto } from './dto/create-employment-role.dto';
import { UpdateEmploymentRoleDto } from './dto/update-employment-role.dto';
import { CloneEmploymentRoleDto } from './dto/clone-employment-role.dto';
import {
  PermissionGroup,
  PermissionMap,
  validatePermissionMap,
} from 'src/access/catalog/permissions';
import type { BundleLevel } from 'src/access/catalog/bundles';
import type { AccessContext } from 'src/access/access-context';
import { AuditService } from 'src/common/audit/audit.service';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import {
  bundleSummary,
  findEscalations,
  grantsOf,
  highRiskAdded,
} from './employment-roles.rules';

/** Who is changing roles: their resolved access (guardrails) + audit identity. */
export interface RoleActor {
  access: Pick<AccessContext, 'permissions' | 'isOwner' | 'isSuperAdmin'>;
  audit: ActorRef;
}

export interface RoleSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  templateKey: string | null;
  homeRoute: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  /** Granted permissions only (legacy booleans dropped). */
  permissions: PermissionMap;
  /** Per module: matching bundle level, or null when custom. */
  bundles: Record<PermissionGroup, BundleLevel | null>;
  /** Active assignments using this role. */
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleMember {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  locationId: string;
  locationName: string;
  isActive: boolean;
  hasPortalAccess: boolean;
}

export interface RoleDetail extends RoleSummary {
  members: RoleMember[];
}

const ENTITY_TYPE = 'employment_role';

/** Fields kept in audit before/after snapshots. */
function auditSnapshot(role: EmploymentRole): Record<string, unknown> {
  return {
    name: role.name,
    description: role.description,
    homeRoute: role.homeRoute,
    isActive: role.isActive,
    permissions: grantsOf(role.permissions),
  };
}

@Injectable()
export class EmploymentRolesService {
  constructor(
    @InjectRepository(EmploymentRole)
    private readonly roleRepo: Repository<EmploymentRole>,
    @InjectRepository(EmployeeOrgLocationAssignment)
    private readonly assignmentRepo: Repository<EmployeeOrgLocationAssignment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /** Rejects maps with unknown keys or bad scopes (the DTO checks too). */
  private assertValidPermissions(permissions: unknown) {
    const problem = validatePermissionMap(permissions);
    if (problem) {
      throw new BadRequestException({
        code: 'INVALID_PERMISSIONS',
        message: `Invalid permissions: ${problem}`,
      });
    }
  }

  /**
   * Guardrails for a permission change: no escalation (owners and super
   * admins exempt) and a reason for newly granted high-risk permissions.
   */
  private assertGrantable(
    actor: RoleActor,
    before: PermissionMap,
    after: PermissionMap,
    reason: string | undefined,
  ) {
    const { access } = actor;
    if (!access.isOwner && !access.isSuperAdmin) {
      const escalations = findEscalations(access.permissions, before, after);
      if (escalations.length) {
        throw new ForbiddenException({
          code: 'ESCALATION',
          permissions: escalations,
          message: `You cannot grant access you do not have: ${escalations.join(', ')}`,
        });
      }
    }
    const risky = highRiskAdded(before, after);
    if (risky.length && !reason?.trim()) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        permissions: risky,
        message: `A reason is required to grant: ${risky.join(', ')}`,
      });
    }
  }

  private assertEditable(role: EmploymentRole) {
    if (role.isSystemRole) {
      throw new ForbiddenException({
        code: 'SYSTEM_ROLE_READ_ONLY',
        message: 'System roles are read-only. Clone this role to customise it.',
      });
    }
  }

  private async assertNameFree(
    repo: Repository<EmploymentRole>,
    organizationId: string,
    name: string,
    exceptId?: string,
  ): Promise<string> {
    const slug = this.slugify(name);
    if (!slug) {
      throw new BadRequestException('Role name needs letters or digits');
    }
    const existing = await repo.findOne({ where: { organizationId, slug } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({
        code: 'ROLE_NAME_TAKEN',
        message: `A role with the name "${name}" already exists`,
      });
    }
    return slug;
  }

  private async memberCounts(
    organizationId: string,
    roleIds?: string[],
  ): Promise<Map<string, number>> {
    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .select('a.employment_role_id', 'roleId')
      .addSelect('COUNT(*)::int', 'count')
      .where('a.organization_id = :organizationId', { organizationId })
      .andWhere('a.is_active = true')
      .andWhere('a.employment_role_id IS NOT NULL')
      .groupBy('a.employment_role_id');
    if (roleIds?.length) {
      qb.andWhere('a.employment_role_id IN (:...roleIds)', { roleIds });
    }
    const rows = await qb.getRawMany<{ roleId: string; count: number }>();
    return new Map(rows.map((r) => [r.roleId, Number(r.count)]));
  }

  private toSummary(role: EmploymentRole, memberCount: number): RoleSummary {
    const permissions = grantsOf(role.permissions);
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      templateKey: role.templateKey,
      homeRoute: role.homeRoute,
      isSystemRole: role.isSystemRole,
      isActive: role.isActive,
      permissions,
      bundles: bundleSummary(permissions),
      memberCount,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private async getRole(
    repo: Repository<EmploymentRole>,
    id: string,
    organizationId: string,
  ): Promise<EmploymentRole> {
    const role = await repo.findOne({ where: { id, organizationId } });
    if (!role) {
      throw new NotFoundException('Employment role not found');
    }
    return role;
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  async findAll(organizationId: string): Promise<EmploymentRole[]> {
    return this.roleRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<EmploymentRole> {
    return this.getRole(this.roleRepo, id, organizationId);
  }

  /** Roles screen list: system templates first, then by name. */
  async list(organizationId: string): Promise<RoleSummary[]> {
    const [roles, counts] = await Promise.all([
      this.roleRepo.find({
        where: { organizationId },
        order: { isSystemRole: 'DESC', name: 'ASC' },
      }),
      this.memberCounts(organizationId),
    ]);
    return roles.map((r) => this.toSummary(r, counts.get(r.id) ?? 0));
  }

  /** One role with everyone assigned to it (per location). */
  async detail(id: string, organizationId: string): Promise<RoleDetail> {
    const role = await this.getRole(this.roleRepo, id, organizationId);
    const assignments = await this.assignmentRepo.find({
      where: { organizationId, employmentRoleId: id },
      relations: { employee: true, location: true },
    });
    const members: RoleMember[] = assignments
      .map((a) => ({
        assignmentId: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee?.fullName ?? '—',
        designation: a.designation,
        locationId: a.locationId,
        locationName: a.location?.name ?? '—',
        isActive: a.isActive,
        hasPortalAccess: a.hasPortalAccess,
      }))
      .sort(
        (x, y) =>
          x.locationName.localeCompare(y.locationName) ||
          x.employeeName.localeCompare(y.employeeName),
      );
    const active = members.filter((m) => m.isActive).length;
    return { ...this.toSummary(role, active), members };
  }

  // ── Writes ─────────────────────────────────────────────────────────────

  async create(
    organizationId: string,
    dto: CreateEmploymentRoleDto,
    actor: RoleActor,
  ): Promise<EmploymentRole> {
    const permissions = (dto.permissions ?? {}) as PermissionMap;
    this.assertValidPermissions(permissions);
    this.assertGrantable(actor, {}, permissions, dto.reason);

    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(EmploymentRole);
      const slug = await this.assertNameFree(repo, organizationId, dto.name);
      const role = await repo.save(
        repo.create({
          organizationId,
          name: dto.name.trim(),
          slug,
          isSystemRole: false,
          templateKey: null,
          permissions,
          description: dto.description ?? null,
          homeRoute: dto.homeRoute ?? null,
          isActive: true,
        }),
      );
      await this.recordAudit(m, actor, organizationId, role.id, {
        action: AuditAction.CREATE,
        after: { ...auditSnapshot(role), ...this.reasonOf(dto.reason) },
      });
      return role;
    });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateEmploymentRoleDto,
    actor: RoleActor,
  ): Promise<EmploymentRole> {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(EmploymentRole);
      const role = await this.getRole(repo, id, organizationId);
      this.assertEditable(role);
      const before = auditSnapshot(role);

      if (dto.name !== undefined) {
        role.slug = await this.assertNameFree(
          repo,
          organizationId,
          dto.name,
          id,
        );
        role.name = dto.name.trim();
      }
      if (dto.isActive !== undefined) role.isActive = dto.isActive;
      if (dto.permissions !== undefined) {
        const next = dto.permissions as PermissionMap;
        this.assertValidPermissions(next);
        this.assertGrantable(
          actor,
          grantsOf(role.permissions),
          next,
          dto.reason,
        );
        role.permissions = next;
      }
      if (dto.description !== undefined) role.description = dto.description;
      if (dto.homeRoute !== undefined) role.homeRoute = dto.homeRoute;

      const saved = await repo.save(role);
      await this.recordAudit(m, actor, organizationId, id, {
        action: AuditAction.UPDATE,
        before,
        after: { ...auditSnapshot(saved), ...this.reasonOf(dto.reason) },
      });
      return saved;
    });
  }

  /** A custom copy of any role (the way to customise a system template). */
  async clone(
    id: string,
    organizationId: string,
    dto: CloneEmploymentRoleDto,
    actor: RoleActor,
  ): Promise<EmploymentRole> {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(EmploymentRole);
      const source = await this.getRole(repo, id, organizationId);
      const permissions = grantsOf(source.permissions);
      this.assertGrantable(actor, {}, permissions, dto.reason);

      const name = dto.name?.trim() || (await this.copyName(repo, source));
      const slug = await this.assertNameFree(repo, organizationId, name);
      const role = await repo.save(
        repo.create({
          organizationId,
          name,
          slug,
          isSystemRole: false,
          templateKey: null,
          permissions,
          description: source.description,
          homeRoute: source.homeRoute,
          isActive: true,
        }),
      );
      await this.recordAudit(m, actor, organizationId, role.id, {
        action: AuditAction.CREATE,
        after: {
          ...auditSnapshot(role),
          clonedFromId: source.id,
          ...this.reasonOf(dto.reason),
        },
      });
      return role;
    });
  }

  async remove(
    id: string,
    organizationId: string,
    actor: RoleActor,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(EmploymentRole);
      const role = await this.getRole(repo, id, organizationId);
      if (role.isSystemRole) {
        throw new ForbiddenException({
          code: 'SYSTEM_ROLE_READ_ONLY',
          message: 'System roles cannot be deleted.',
        });
      }
      const memberCount = await m
        .getRepository(EmployeeOrgLocationAssignment)
        .count({
          where: { organizationId, employmentRoleId: id, isActive: true },
        });
      if (memberCount > 0) {
        throw new ConflictException({
          code: 'ROLE_HAS_MEMBERS',
          memberCount,
          message: `${memberCount} active member${memberCount === 1 ? '' : 's'} still use this role. Move them to another role first.`,
        });
      }
      const before = auditSnapshot(role);
      await repo.remove(role);
      // Hard delete — recorded as VOID (the audit enum has no DELETE).
      await this.recordAudit(m, actor, organizationId, id, {
        action: AuditAction.VOID,
        before,
      });
    });
  }

  private reasonOf(reason: string | undefined) {
    const trimmed = reason?.trim();
    return trimmed ? { reason: trimmed } : {};
  }

  /** "<name> (copy)", then "(copy 2)"… until the slug is free. */
  private async copyName(
    repo: Repository<EmploymentRole>,
    source: EmploymentRole,
  ): Promise<string> {
    for (let n = 1; n < 50; n++) {
      const name = `${source.name} (copy${n === 1 ? '' : ` ${n}`})`;
      const taken = await repo.findOne({
        where: {
          organizationId: source.organizationId,
          slug: this.slugify(name),
        },
      });
      if (!taken) return name;
    }
    throw new ConflictException('Pick a name for the copy');
  }

  private recordAudit(
    m: EntityManager,
    actor: RoleActor,
    organizationId: string,
    entityId: string,
    entry: {
      action: AuditAction;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
  ) {
    return this.audit.record(m, actor.audit, {
      organizationId,
      entityType: ENTITY_TYPE,
      entityId,
      ...entry,
    });
  }
}
