import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { AccessContext, AccessRole } from './access-context';
import {
  expandImplies,
  filterByFeatures,
  fullGrant,
  normalizeGrants,
  PERMISSION_KEYS,
  PermissionMap,
} from './catalog/permissions';
import { AccessChangeBus } from './version/access-change-bus';
import { AccessVersionService } from './version/access-version.service';

/** A resolved context is reused this long (the version key handles changes). */
export const ACCESS_CACHE_TTL_MS = 5 * 60_000;
export const ACCESS_CACHE_MAX = 10_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && UUID.test(v);

/**
 * (user, org, location) → AccessContext:
 *
 *   effective = role permissions (+ implies)  ∩  permissions of enabled features
 *
 * - super admin / owner → every catalog permission at its widest scope
 * - employee → the employment role on their active, portal-enabled
 *   assignment at that location (inactive role / no assignment → nothing)
 * - then every permission whose feature is off for the org is dropped
 *
 * Cached per (user, org, location, access_version); any access change bumps
 * the version, so a stale entry is simply never hit again.
 */
@Injectable()
export class AccessResolver {
  private readonly cache = new Map<
    string,
    { ctx: AccessContext; at: number }
  >();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrganizationOwnership)
    private readonly ownershipRepo: Repository<OrganizationOwnership>,
    @InjectRepository(EmployeeOrgLocationAssignment)
    private readonly assignmentRepo: Repository<EmployeeOrgLocationAssignment>,
    private readonly featureFlags: FeatureFlagsService,
    private readonly versions: AccessVersionService,
    bus: AccessChangeBus,
  ) {
    bus.onChange((c) => this.dropOrganization(c.organizationId));
  }

  async resolve(
    userId: string,
    organizationId: string,
    locationId: string | null,
  ): Promise<AccessContext> {
    // Version first, data second: a change committed in between is cached
    // under the old version and refetched once the bump lands.
    const version = await this.versions.current(organizationId);
    const key = `${userId}|${organizationId}|${locationId ?? ''}|${version}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < ACCESS_CACHE_TTL_MS) return hit.ctx;

    const ctx = await this.build(userId, organizationId, locationId, version);
    this.cache.delete(key);
    this.cache.set(key, { ctx, at: Date.now() });
    if (this.cache.size > ACCESS_CACHE_MAX) {
      // Map keeps insertion order: drop the oldest entry.
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    return ctx;
  }

  /** Forget every cached context of an org (its version moved). */
  dropOrganization(organizationId: string) {
    const marker = `|${organizationId}|`;
    for (const key of this.cache.keys()) {
      if (key.includes(marker)) this.cache.delete(key);
    }
  }

  private async build(
    userId: string,
    organizationId: string,
    locationId: string | null,
    version: number,
  ): Promise<AccessContext> {
    const [user, ownership, assignment, features] = await Promise.all([
      this.userRepo.findOne({
        where: { uuid: userId },
        select: { uuid: true, globalRole: true },
      }),
      this.ownershipRepo.findOne({ where: { userId, organizationId } }),
      locationId
        ? this.assignmentRepo.findOne({
            where: { userId, organizationId, locationId, isActive: true },
            relations: { employmentRole: true },
          })
        : Promise.resolve(null),
      this.featureFlags.getEnabledFeatures(organizationId),
    ]);

    const isSuperAdmin = user?.globalRole === GlobalRole.SUPER_ADMIN;
    const isOwner = !!ownership;
    const portal = !!assignment?.hasPortalAccess;
    const role =
      assignment?.employmentRole?.isActive &&
      assignment.employmentRole.organizationId === organizationId
        ? assignment.employmentRole
        : null;

    let grants: PermissionMap = {};
    if (isSuperAdmin || isOwner) {
      for (const p of PERMISSION_KEYS) grants[p] = fullGrant(p);
    } else if (portal && role) {
      grants = expandImplies(normalizeGrants(role.permissions));
    }

    const showRole = role && (portal || isOwner || isSuperAdmin);
    const roles: AccessRole[] = showRole
      ? [
          {
            id: role.id,
            name: role.name,
            templateKey: role.templateKey ?? null,
          },
        ]
      : [];

    return new AccessContext({
      userId,
      organizationId,
      locationId,
      version,
      isSuperAdmin,
      isOwner,
      isMember: isSuperAdmin || isOwner || portal,
      employeeId: assignment?.employeeId ?? null,
      features: [...features].sort(),
      permissions: filterByFeatures(grants, features),
      roles,
      homeRoute: showRole ? (role.homeRoute ?? null) : null,
    });
  }
}
