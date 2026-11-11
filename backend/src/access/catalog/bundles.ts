import {
  fullGrant,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSIONS,
} from './permissions';
import type { Permission, PermissionGroup, PermissionMap } from './permissions';

/**
 * Ready-made per-module levels for the roles screen ("None / Basic / Full"),
 * so owners pick a level per module and only open "Advanced" for single
 * checkboxes. `none` is always `{}`.
 */
export type BundleLevel = 'none' | 'basic' | 'full';

export const BUNDLE_LEVELS: readonly BundleLevel[] = ['none', 'basic', 'full'];

export type ModuleBundles = Record<BundleLevel, PermissionMap>;

/** Every permission of a module at its full reach. */
function fullOf(group: PermissionGroup): PermissionMap {
  const out: PermissionMap = {};
  for (const key of PERMISSION_KEYS) {
    if (PERMISSIONS[key].group === group) out[key] = fullGrant(key);
  }
  return out;
}

const BASIC: Record<PermissionGroup, PermissionMap> = {
  Patients: {
    'patients.view': 'location',
    'patients.create': true,
    'patients.edit': true,
    'patients.documents.manage': true,
  },
  Appointments: {
    'appointments.view': 'location',
    'appointments.book': true,
    'appointments.reschedule': true,
    'appointments.cancel': true,
    'appointments.requests.manage': true,
  },
  Queue: {
    'queue.board.view': true,
    'queue.checkin': true,
    'queue.entry.manage': true,
    'patients.app_link.manage': true,
  },
  Consultation: {
    'consultation.conduct': 'own',
    'prescriptions.create': true,
  },
  Billing: {
    'billing.desk.use': true,
    'billing.invoice.view': 'location',
    'billing.payment.collect': true,
  },
  Discounts: { 'billing.discount.apply': true },
  Expenses: { 'expenses.view': true },
  Commissions: { 'earnings.own.view': true },
  Lab: {
    'lab.orders.view': 'location',
    'lab.orders.create': true,
  },
  Inventory: { 'inventory.view': true },
  Team: { 'employees.view': true },
  Reports: { 'reports.clinical.view': 'location' },
  Admin: {
    'admin.settings.manage': true,
    'admin.audit.view': true,
  },
};

export const BUNDLES: Record<PermissionGroup, ModuleBundles> =
  Object.fromEntries(
    PERMISSION_GROUPS.map((group) => [
      group,
      { none: {}, basic: BASIC[group], full: fullOf(group) },
    ]),
  ) as Record<PermissionGroup, ModuleBundles>;

/** Which bundle level a role's permissions match exactly in one module, if any. */
export function matchBundle(
  group: PermissionGroup,
  grants: PermissionMap,
): BundleLevel | null {
  const inGroup = (Object.keys(grants) as Permission[]).filter(
    (p) => PERMISSIONS[p].group === group,
  );
  for (const level of BUNDLE_LEVELS) {
    const bundle = BUNDLES[group][level];
    const keys = Object.keys(bundle) as Permission[];
    if (
      keys.length === inGroup.length &&
      keys.every((k) => grants[k] === bundle[k])
    ) {
      return level;
    }
  }
  return null;
}
