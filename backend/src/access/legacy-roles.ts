import { AppRole } from 'src/common/enums/app-role.enum';
import {
  expandImplies,
  normalizeGrants,
  Permission,
} from './catalog/permissions';

/**
 * Legacy `AppRole[]` for `@Roles(...)` endpoints, derived from a role's
 * new-format permission map until wave 2 moves those endpoints to `@Can`.
 * Fail-closed: an empty map (or the old `canManageSettings`-style booleans)
 * gives no roles.
 */
export function legacyRolesFromPermissions(raw: unknown): AppRole[] {
  const grants = expandImplies(normalizeGrants(raw));
  const has = (p: Permission) => grants[p] !== undefined;
  const roles: AppRole[] = [];
  if (Object.keys(grants).some((p) => p.startsWith('admin.'))) {
    roles.push(AppRole.CLINIC_ADMIN);
  }
  if (has('appointments.book') || has('billing.desk.use')) {
    roles.push(AppRole.RECEPTIONIST);
  }
  if (has('consultation.conduct')) roles.push(AppRole.DOCTOR);
  return roles;
}
