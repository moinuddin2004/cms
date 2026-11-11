import type { MeAccess, PermissionKey, PermissionRequirement, Scope } from '../types/access.types';

export interface AccessChecks {
  /** Any-of: true when at least one listed permission is granted. No requirement → true. */
  can: (perm?: PermissionRequirement | null) => boolean;
  /** All-of: true only when every listed permission is granted. */
  canAll: (perms: readonly PermissionKey[]) => boolean;
  /** Row-level reach of a granted permission, or null when not granted. */
  scope: (perm: PermissionKey) => Scope | null;
  hasFeature: (key: string) => boolean;
}

/**
 * Pure checks over a `/me/access` payload. Never branch on role names —
 * owners and super admins simply arrive with the full catalog granted.
 */
export function createAccessChecks(data: MeAccess | undefined): AccessChecks {
  const permissions = data?.permissions ?? {};
  const features = new Set(data?.features ?? []);

  const scope = (perm: PermissionKey): Scope | null => {
    const grant = permissions[perm] as Scope | true | undefined;
    if (grant === undefined) return null;
    return grant === true ? 'org' : grant;
  };
  const has = (perm: PermissionKey) => scope(perm) !== null;

  return {
    can: (perm) => {
      if (perm == null) return true;
      if (typeof perm === 'string') return has(perm);
      return perm.length === 0 || perm.some(has);
    },
    canAll: (perms) => perms.every(has),
    scope,
    hasFeature: (key) => features.has(key),
  };
}
