import type { ObjectLiteral } from 'typeorm';
import {
  isPermission,
  Permission,
  PermissionMap,
  Scope,
} from './catalog/permissions';

export type Decision = 'allow' | 'deny' | 'needs_approval';

/**
 * Input for `decide()`. The default rule is a range check: inside
 * [min, max] → allow; outside → allow only with the escalation permission,
 * else `needs_approval` when the clinic runs an approval flow, else deny.
 */
export interface DecideInput {
  value?: number;
  min?: number;
  max?: number;
  /** The clinic routes out-of-range requests for approval instead of denying. */
  approvalFlow?: boolean;
}

export type AccessPolicy = (ctx: AccessContext, input: DecideInput) => Decision;

/** Permission that lifts a range limit of another (e.g. custom vs preset discount). */
export const ESCALATIONS: Partial<Record<Permission, Permission>> = {
  'billing.discount.apply': 'billing.discount.custom',
};

/** Custom `decide()` rules per permission; modules register theirs here. */
export const ACCESS_POLICIES = new Map<Permission, AccessPolicy>();

export interface AccessRole {
  id: string;
  name: string;
  templateKey: string | null;
}

export interface AccessContextInit {
  userId: string;
  organizationId: string;
  locationId: string | null;
  version: number;
  isSuperAdmin: boolean;
  isOwner: boolean;
  /** Active portal member at the location (owners/super admins always are). */
  isMember: boolean;
  employeeId: string | null;
  features: string[];
  permissions: PermissionMap;
  roles: AccessRole[];
  homeRoute: string | null;
}

/** Anything with `andWhere` — select / update / delete query builders. */
interface WhereBuilder {
  andWhere(where: string, parameters?: ObjectLiteral): unknown;
}

export interface ScopeColumns {
  /** Column holding the owning employee id, e.g. `p.primary_doctor_id`. */
  own?: string;
  /** Column holding the location id, e.g. `p.location_id`. */
  location?: string;
}

let paramSeq = 0;

/**
 * What one user may do in one org + location, resolved once per
 * (user, org, location, access_version) by AccessResolver. Code asks
 * `can()` / `scope()` / `decide()` — never role names.
 */
export class AccessContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly locationId: string | null;
  readonly version: number;
  readonly isSuperAdmin: boolean;
  readonly isOwner: boolean;
  readonly isMember: boolean;
  readonly employeeId: string | null;
  /** Active feature keys for the org. */
  readonly features: readonly string[];
  /** Granted permissions only (feature-filtered, implies expanded). */
  readonly permissions: Readonly<PermissionMap>;
  readonly roles: readonly AccessRole[];
  readonly homeRoute: string | null;

  constructor(init: AccessContextInit) {
    this.userId = init.userId;
    this.organizationId = init.organizationId;
    this.locationId = init.locationId;
    this.version = init.version;
    this.isSuperAdmin = init.isSuperAdmin;
    this.isOwner = init.isOwner;
    this.isMember = init.isMember;
    this.employeeId = init.employeeId;
    this.features = Object.freeze([...init.features]);
    this.permissions = Object.freeze({ ...init.permissions });
    this.roles = Object.freeze(init.roles.map((r) => ({ ...r })));
    this.homeRoute = init.homeRoute;
  }

  can(perm: Permission): boolean {
    return isPermission(perm) && this.permissions[perm] !== undefined;
  }

  canAll(perms: readonly Permission[]): boolean {
    return perms.every((p) => this.can(p));
  }

  /** Reach of a granted permission (`org` for unscoped ones), or null. */
  scope(perm: Permission): Scope | null {
    const grant = isPermission(perm) ? this.permissions[perm] : undefined;
    if (grant === undefined) return null;
    return grant === true ? 'org' : grant;
  }

  /**
   * Row-level filter for `perm`: `own` → `cols.own = employeeId`,
   * `location` → `cols.location = locationId`, `org` → nothing (the org
   * filter is the caller's). No grant (or no employee / location to match)
   * → no rows. Throws when the needed column was not given: that is a
   * programming error, not a reason to show nothing.
   */
  applyScope<Q extends WhereBuilder>(
    qb: Q,
    perm: Permission,
    cols: ScopeColumns,
  ): Q {
    const scope = this.scope(perm);
    if (scope === null) {
      qb.andWhere('1 = 0');
      return qb;
    }
    if (scope === 'org') return qb;

    const column = scope === 'own' ? cols.own : cols.location;
    if (!column) {
      throw new Error(
        `applyScope('${perm}'): no column given for scope "${scope}"`,
      );
    }
    const value = scope === 'own' ? this.employeeId : this.locationId;
    if (!value) {
      qb.andWhere('1 = 0');
      return qb;
    }
    const param = `access_scope_${++paramSeq}`;
    qb.andWhere(`${column} = :${param}`, { [param]: value });
    return qb;
  }

  /** allow / deny / needs_approval for one action (see DecideInput). */
  decide(perm: Permission, input: DecideInput = {}): Decision {
    const escalation = ESCALATIONS[perm];
    const escalated = !!escalation && this.can(escalation);
    if (!this.can(perm) && !escalated) return 'deny';

    const policy = ACCESS_POLICIES.get(perm);
    if (policy) return policy(this, input);

    const { value, min, max } = input;
    const outOfRange =
      value !== undefined &&
      ((max !== undefined && value > max) ||
        (min !== undefined && value < min));
    if (!outOfRange || escalated) return 'allow';
    return input.approvalFlow ? 'needs_approval' : 'deny';
  }
}
