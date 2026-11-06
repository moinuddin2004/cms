import { EntityManager } from 'typeorm';
import { expandImplies, normalizeGrants } from 'src/access/catalog/permissions';
import type { Permission } from 'src/access/catalog/permissions';
import { sqlRows } from 'src/common/database/sql';
import { NotificationAudience, RecipientType } from '../notifications.enums';
import type { NotificationRecipient } from '../services/notification.service';

/**
 * Who in a clinic gets a `staff` notification — always picked by owner /
 * permission / employment, never by role name (CLAUDE.md access rules).
 * Super admins are not clinic staff and are never included.
 */

/** A clinic-team user as a notification recipient. */
export const staffRecipient = (userId: string): NotificationRecipient => ({
  audience: NotificationAudience.STAFF,
  type: RecipientType.USER,
  id: userId,
});

/** The clinic's owners. */
export async function ownerUserIds(
  m: EntityManager,
  organizationId: string,
): Promise<string[]> {
  const rows = await sqlRows<{ user_id: string }>(
    m,
    `SELECT DISTINCT o.user_id
       FROM organization_ownership o
       JOIN users u ON u.uuid = o.user_id
      WHERE o.organization_id = $1 AND u.status = 'active'`,
    [organizationId],
  );
  return rows.map((r) => r.user_id);
}

/** The login of an employee (prefers their assignment at `locationId`). */
export async function employeeUserId(
  m: EntityManager,
  organizationId: string,
  employeeId: string | null | undefined,
  locationId?: string | null,
): Promise<string | null> {
  if (!employeeId) return null;
  const [row] = await sqlRows<{ user_id: string }>(
    m,
    `SELECT user_id FROM employee_org_location_assignments
      WHERE employee_id = $1 AND organization_id = $2 AND user_id IS NOT NULL
      ORDER BY (location_id = $3) DESC NULLS LAST, is_active DESC
      LIMIT 1`,
    [employeeId, organizationId, locationId ?? null],
  );
  return row?.user_id ?? null;
}

/**
 * Users holding `permission` at `locationId` (or anywhere in the org when
 * null): every owner, plus staff with portal access whose active employment
 * role grants it (directly or through `implies`).
 */
export async function usersWithPermission(
  m: EntityManager,
  organizationId: string,
  locationId: string | null,
  permission: Permission,
): Promise<string[]> {
  const owners = await ownerUserIds(m, organizationId);
  const staff = await sqlRows<{ user_id: string; permissions: unknown }>(
    m,
    `SELECT DISTINCT a.user_id, r.permissions
       FROM employee_org_location_assignments a
       JOIN employment_roles r ON r.id = a.employment_role_id
       JOIN users u ON u.uuid = a.user_id
      WHERE a.organization_id = $1
        AND ($2::uuid IS NULL OR a.location_id = $2)
        AND a.is_active AND a.has_portal_access AND a.user_id IS NOT NULL
        AND r.is_active AND r.organization_id = $1
        AND u.status = 'active'`,
    [organizationId, locationId],
  );
  const holders = staff
    .filter((s) => expandImplies(normalizeGrants(s.permissions))[permission])
    .map((s) => s.user_id);
  return [...new Set([...owners, ...holders])];
}
