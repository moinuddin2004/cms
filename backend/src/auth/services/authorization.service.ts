import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { Actor, ALL_APP_ROLES } from 'src/common/enums/app-role.enum';
import { legacyRolesFromPermissions } from 'src/access/legacy-roles';
import type { AccessContext } from 'src/access/access-context';

/**
 * Represents a user's accessible organization with its locations.
 */
export interface AccessibleOrganization {
  id: string;
  name: string;
  slug: string;
  accessSource: 'super_admin' | 'owner' | 'employee';
  specialtyTags: string[];
  /** ISO 4217 code money is shown in (web app `formatCurrency`). */
  currency: string;
  locations: AccessibleLocation[];
}

export interface AccessibleLocation {
  id: string;
  name: string;
  code: string;
  accessSource: 'super_admin' | 'owner' | 'employee';
  isPrimary: boolean;
  isMainBranch: boolean;
  timezone: string;
}

/**
 * @deprecated Legacy per-location flags still returned by
 * `POST /auth/switch-location`; the web app reads `/me/access` instead.
 * Derived from the AccessContext (`legacyLocationFlags`), never from the
 * old role booleans.
 */
export interface UserPermissions {
  canViewAppointments: boolean;
  canCreateAppointments: boolean;
  canManageStaff: boolean;
  canViewFinance: boolean;
  canManageLocations: boolean;
  canManageUsers: boolean;
  canViewBilling: boolean;
  canManageSettings: boolean;
}

export interface UserAccessInfo {
  isSuperAdmin: boolean;
  accessSource: 'super_admin' | 'owner' | 'employee' | null;
  accessibleOrganizations: AccessibleOrganization[];
  defaultOrganizationId: string | null;
  defaultLocationId: string | null;
}

/**
 * Centralized authorization service.
 *
 * Access hierarchy:
 * 1. Super Admin → all orgs → all locations
 * 2. Owner → owned orgs → all locations in those orgs
 * 3. Employee with portal access → assigned locations only
 */
@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrganizationOwnership)
    private readonly ownershipRepo: Repository<OrganizationOwnership>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeOrgLocationAssignment)
    private readonly assignmentRepo: Repository<EmployeeOrgLocationAssignment>,
  ) {}

  /**
   * Check if user is a super admin.
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { uuid: userId },
      select: ['uuid', 'globalRole'],
    });
    return user?.globalRole === GlobalRole.SUPER_ADMIN;
  }

  /**
   * Check if user is an owner of the specified organization.
   */
  async isOwner(userId: string, organizationId: string): Promise<boolean> {
    const ownership = await this.ownershipRepo.findOne({
      where: { userId, organizationId },
    });
    return !!ownership;
  }

  /**
   * Resolve all accessible organizations and locations for a user.
   * Used after login to determine where the user can navigate.
   */
  async resolveUserAccess(userId: string): Promise<UserAccessInfo> {
    const user = await this.userRepo.findOne({
      where: { uuid: userId },
      select: [
        'uuid',
        'globalRole',
        'lastAccessedOrganizationId',
        'lastAccessedLocationId',
      ],
    });

    if (!user) {
      return {
        isSuperAdmin: false,
        accessSource: null,
        accessibleOrganizations: [],
        defaultOrganizationId: null,
        defaultLocationId: null,
      };
    }

    // ── Super Admin: all orgs → all locations ──
    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      const orgs = await this.orgRepo.find({
        where: { isActive: true },
        order: { name: 'ASC' },
      });

      const result: AccessibleOrganization[] = [];
      for (const org of orgs) {
        const locations = await this.locationRepo.find({
          where: { organizationId: org.id, isActive: true },
          order: { isMainBranch: 'DESC', name: 'ASC' },
        });
        result.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          accessSource: 'super_admin',
          specialtyTags: org.specialtyTags ?? ['general'],
          currency: org.currency ?? 'PKR',
          locations: locations.map((loc) => ({
            id: loc.id,
            name: loc.name,
            code: loc.code,
            accessSource: 'super_admin' as const,
            isPrimary: false,
            isMainBranch: loc.isMainBranch,
            timezone: loc.timezone,
          })),
        });
      }

      return {
        isSuperAdmin: true,
        accessSource: 'super_admin',
        accessibleOrganizations: result,
        defaultOrganizationId:
          user.lastAccessedOrganizationId || result[0]?.id || null,
        defaultLocationId:
          user.lastAccessedLocationId || result[0]?.locations[0]?.id || null,
      };
    }

    // ── Non-super-admin: collect from ownership + employee assignments ──
    const orgMap = new Map<string, AccessibleOrganization>();
    let primaryAccessSource: 'owner' | 'employee' | null = null;

    // 1. Owner entries — full access to all locations in their orgs
    const ownerships = await this.ownershipRepo.find({
      where: { userId },
      relations: ['organization'],
    });

    for (const ow of ownerships) {
      if (!ow.organization?.isActive) continue;
      primaryAccessSource = primaryAccessSource || 'owner';

      const locations = await this.locationRepo.find({
        where: { organizationId: ow.organizationId, isActive: true },
        order: { isMainBranch: 'DESC', name: 'ASC' },
      });

      orgMap.set(ow.organizationId, {
        id: ow.organizationId,
        name: ow.organization.name,
        slug: ow.organization.slug,
        accessSource: 'owner',
        specialtyTags: ow.organization.specialtyTags ?? ['general'],
        currency: ow.organization.currency ?? 'PKR',
        locations: locations.map((loc) => ({
          id: loc.id,
          name: loc.name,
          code: loc.code,
          accessSource: 'owner' as const,
          isPrimary: false,
          isMainBranch: loc.isMainBranch,
          timezone: loc.timezone,
        })),
      });
    }

    // 2. Employee entries — query assignments directly (userId/hasPortalAccess now live on assignments)
    const assignments = await this.assignmentRepo.find({
      where: { userId, hasPortalAccess: true, isActive: true },
      relations: ['organization', 'location'],
    });

    for (const asgn of assignments) {
      if (!asgn.organization?.isActive) continue;
      primaryAccessSource = primaryAccessSource || 'employee';

      // If user is already owner of this org, skip (owner has full access)
      if (
        orgMap.has(asgn.organizationId) &&
        orgMap.get(asgn.organizationId)!.accessSource === 'owner'
      ) {
        continue;
      }

      if (!orgMap.has(asgn.organizationId)) {
        orgMap.set(asgn.organizationId, {
          id: asgn.organizationId,
          name: asgn.organization.name,
          slug: asgn.organization.slug,
          accessSource: 'employee',
          specialtyTags: asgn.organization.specialtyTags ?? ['general'],
          currency: asgn.organization.currency ?? 'PKR',
          locations: [],
        });
      }

      const org = orgMap.get(asgn.organizationId)!;
      if (asgn.location?.isActive) {
        // Don't add duplicate locations
        if (!org.locations.find((l) => l.id === asgn.locationId)) {
          org.locations.push({
            id: asgn.locationId,
            name: asgn.location.name,
            code: asgn.location.code,
            accessSource: 'employee',
            isPrimary: asgn.isPrimary,
            isMainBranch: asgn.location.isMainBranch,
            timezone: asgn.location.timezone,
          });
        }
      }
    }

    const accessibleOrganizations = Array.from(orgMap.values());

    // Determine defaults
    let defaultOrgId = user.lastAccessedOrganizationId;
    let defaultLocId = user.lastAccessedLocationId;

    // Validate that defaults are still accessible
    if (defaultOrgId && !orgMap.has(defaultOrgId)) {
      defaultOrgId = null;
      defaultLocId = null;
    }
    if (defaultOrgId && defaultLocId) {
      const org = orgMap.get(defaultOrgId);
      if (org && !org.locations.find((l) => l.id === defaultLocId)) {
        defaultLocId = null;
      }
    }

    // Fallback to primary or first available
    if (!defaultOrgId && accessibleOrganizations.length > 0) {
      defaultOrgId = accessibleOrganizations[0].id;
    }
    if (!defaultLocId && defaultOrgId) {
      const org = orgMap.get(defaultOrgId);
      if (org) {
        const primary = org.locations.find((l) => l.isPrimary);
        defaultLocId = primary?.id || org.locations[0]?.id || null;
      }
    }

    return {
      isSuperAdmin: false,
      accessSource: primaryAccessSource,
      accessibleOrganizations,
      defaultOrganizationId: defaultOrgId || null,
      defaultLocationId: defaultLocId || null,
    };
  }

  /**
   * Validate that a user has access to a specific organization + location.
   */
  async validateAccess(
    userId: string,
    organizationId: string,
    locationId: string,
  ): Promise<boolean> {
    // Super admin always has access
    if (await this.isSuperAdmin(userId)) {
      return true;
    }

    // Owner has access to all locations in their org
    if (await this.isOwner(userId, organizationId)) {
      const location = await this.locationRepo.findOne({
        where: { id: locationId, organizationId, isActive: true },
      });
      return !!location;
    }

    // Employee: check assignments directly (userId/hasPortalAccess now on assignments)
    const assignment = await this.assignmentRepo.findOne({
      where: {
        userId,
        organizationId,
        locationId,
        hasPortalAccess: true,
        isActive: true,
      },
    });
    return !!assignment;
  }

  /**
   * Resolve the clinic roles a user holds at one organization + location.
   *
   * - Super admin / organization owner → every role.
   * - Employee with portal access and an active role → derived from the
   *   role's new-format permissions (see `legacyRolesFromPermissions`):
   *   any `admin.*` → clinic_admin; `appointments.book` / `billing.desk.use`
   *   → receptionist; `consultation.conduct` → doctor. Fail-closed: no
   *   matching permission, no role. Doctor actions are further limited to
   *   the doctor's own appointments by the caller.
   */
  async resolveActor(
    userId: string,
    organizationId: string,
    locationId: string,
  ): Promise<Actor> {
    const assignment = await this.assignmentRepo.findOne({
      where: { userId, organizationId, locationId, isActive: true },
      relations: ['employmentRole'],
    });
    const employeeId = assignment?.employeeId ?? null;

    if (
      (await this.isSuperAdmin(userId)) ||
      (await this.isOwner(userId, organizationId))
    ) {
      return { userId, roles: [...ALL_APP_ROLES], employeeId };
    }

    const role = assignment?.employmentRole;
    if (!assignment?.hasPortalAccess || !role?.isActive) {
      return { userId, roles: [], employeeId };
    }

    return {
      userId,
      roles: legacyRolesFromPermissions(role.permissions),
      employeeId,
    };
  }

  /**
   * Whether the user may act in this organization at all: super admin,
   * owner, or an active portal assignment at any of its locations.
   */
  async canAccessOrganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) return true;
    if (await this.isOwner(userId, organizationId)) return true;
    return this.assignmentRepo.exists({
      where: {
        userId,
        organizationId,
        hasPortalAccess: true,
        isActive: true,
      },
    });
  }
}

/**
 * @deprecated The old 8 flags, derived from the new permissions so the
 * switch-location response stays truthful until it is removed.
 */
export function legacyLocationFlags(access: AccessContext): UserPermissions {
  return {
    canViewAppointments: access.can('appointments.view'),
    canCreateAppointments: access.can('appointments.book'),
    canManageStaff: access.can('employees.manage'),
    canViewFinance: access.can('finance.overview.view'),
    canManageLocations: access.can('admin.locations.manage'),
    canManageUsers: access.can('admin.users.manage'),
    canViewBilling: access.can('billing.invoice.view'),
    canManageSettings: access.can('admin.settings.manage'),
  };
}
