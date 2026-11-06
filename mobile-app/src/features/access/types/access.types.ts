import type { Permission } from '../generated/catalog';

/** Permission key from the shared catalog (written by the backend's `npm run access:export`). */
export type PermissionKey = Permission;

export type Scope = 'own' | 'location' | 'org';

/** One permission, or several of which any one is enough. */
export type PermissionRequirement = PermissionKey | readonly PermissionKey[];

/** `GET /me/access` — the resolved access of the signed-in user. */
export interface MeAccess {
  /** `organizations.access_version`; bumps on every role/flag/layout change. */
  version: number;
  organizationId: string;
  locationId: string | null;
  isSuperAdmin: boolean;
  isOwner: boolean;
  /** Enabled feature keys for the active org/location. */
  features: string[];
  /** Granted permissions only; a missing key means no access. */
  permissions: Partial<Record<PermissionKey, Scope | true>>;
  roles: { id: string; name: string; templateKey: string | null }[];
  employeeId: string | null;
  homeRoute: string | null;
}
