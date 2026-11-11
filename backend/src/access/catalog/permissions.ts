/**
 * Canonical permission catalog — the single source of truth for what a role
 * can be granted. Owners only combine these keys into roles; they can never
 * invent new ones. `npm run access:export` copies this file's keys, feature
 * map and bundles to `web-app/src/features/access/generated/catalog.ts`.
 *
 * Every permission belongs to a feature: when the org has that feature off,
 * the permission is dropped at resolution time (not deleted from roles), so
 * turning the feature back on restores access exactly as it was.
 *
 * Pure data + pure helpers only: the export script imports this without Nest.
 */

/** How far a scoped permission reaches. Wider ranks include narrower ones. */
export type Scope = 'own' | 'location' | 'org';

export const SCOPES: readonly Scope[] = ['own', 'location', 'org'];

export const SCOPE_RANK: Record<Scope, number> = {
  own: 1,
  location: 2,
  org: 3,
};

/** Features that are always on (no `org_feature_flags` row involved). */
export const CORE_FEATURE = 'core';

export type PermissionRisk = 'high';

export interface PermissionDef {
  /** Feature key from the feature catalog (or `core`, always on). */
  feature: string;
  label: string;
  /** Module the permission is listed under (bundles are per module). */
  group: string;
  /** Present → the grant carries a scope (`own` / `location` / `org`). */
  scopes?: readonly Scope[];
  /** Granting this also grants these. */
  implies?: readonly string[];
  /** High-risk grants need a confirm + reason in the roles UI. */
  risk?: PermissionRisk;
}

const ALL_SCOPES = SCOPES;

function defineCatalog<K extends string>(
  catalog: Record<K, PermissionDef>,
): Record<K, PermissionDef> {
  return catalog;
}

export const PERMISSIONS = defineCatalog({
  // ── Patients (patients.core) ──
  'patients.view': {
    feature: 'patients.core',
    label: 'View patients',
    group: 'Patients',
    scopes: ALL_SCOPES,
  },
  'patients.create': {
    feature: 'patients.core',
    label: 'Register patients',
    group: 'Patients',
    implies: ['patients.view'],
  },
  'patients.edit': {
    feature: 'patients.core',
    label: 'Edit patient details',
    group: 'Patients',
    implies: ['patients.view'],
  },
  'patients.delete': {
    feature: 'patients.core',
    label: 'Delete patients',
    group: 'Patients',
    implies: ['patients.view'],
    risk: 'high',
  },
  'patients.export': {
    feature: 'patients.core',
    label: 'Export patient data',
    group: 'Patients',
    implies: ['patients.view'],
    risk: 'high',
  },
  'patients.price.view': {
    feature: 'patients.core',
    label: 'See treatment prices',
    group: 'Patients',
  },
  'patients.clinical.view': {
    feature: 'patients.core',
    label: 'View clinical records',
    group: 'Patients',
  },
  'patients.clinical.edit': {
    feature: 'patients.core',
    label: 'Edit clinical records',
    group: 'Patients',
    implies: ['patients.clinical.view'],
  },
  'patients.app_link.manage': {
    feature: 'patient_app',
    label: 'Link patients to the app',
    group: 'Patients',
    risk: 'high',
  },

  // ── Patient extras ──
  'patients.documents.manage': {
    feature: 'patients.documents',
    label: 'Manage patient documents',
    group: 'Patients',
  },
  'patients.chart.edit': {
    feature: 'patients.teeth_chart',
    label: 'Edit dental chart',
    group: 'Patients',
    implies: ['patients.clinical.view'],
  },
  'plans.manage': {
    feature: 'patients.treatment_plans',
    label: 'Manage treatment plans',
    group: 'Patients',
  },
  'plans.templates.manage': {
    feature: 'patients.treatment_plans',
    label: 'Manage treatment plan templates',
    group: 'Patients',
  },

  // ── Appointments (appointments.core) ──
  'appointments.view': {
    feature: 'appointments.core',
    label: 'View appointments',
    group: 'Appointments',
    scopes: ALL_SCOPES,
  },
  'appointments.book': {
    feature: 'appointments.core',
    label: 'Book appointments',
    group: 'Appointments',
    implies: ['appointments.view'],
  },
  'appointments.reschedule': {
    feature: 'appointments.core',
    label: 'Reschedule appointments',
    group: 'Appointments',
    implies: ['appointments.view'],
  },
  'appointments.cancel': {
    feature: 'appointments.core',
    label: 'Cancel appointments',
    group: 'Appointments',
    implies: ['appointments.view'],
  },
  'appointments.override_rules': {
    feature: 'appointments.core',
    label: 'Override booking rules',
    group: 'Appointments',
    implies: ['appointments.book'],
    risk: 'high',
  },
  'appointments.requests.manage': {
    feature: 'patient_app',
    label: 'Handle patient appointment requests',
    group: 'Appointments',
  },

  // ── Queue (appointments.core) ──
  'queue.board.view': {
    feature: 'appointments.core',
    label: 'View reception queue board',
    group: 'Queue',
  },
  'queue.checkin': {
    feature: 'appointments.core',
    label: 'Check patients in',
    group: 'Queue',
    implies: ['queue.board.view'],
  },
  'queue.entry.manage': {
    feature: 'appointments.core',
    label: 'Skip, rejoin or remove queue entries',
    group: 'Queue',
    implies: ['queue.board.view'],
  },
  'queue.entry.reprioritize': {
    feature: 'appointments.core',
    label: 'Reprioritize the queue',
    group: 'Queue',
    implies: ['queue.board.view'],
  },
  'queue.doctor.own': {
    feature: 'appointments.core',
    label: 'Run own doctor queue',
    group: 'Queue',
  },
  'queue.doctor.any': {
    feature: 'appointments.core',
    label: "Run any doctor's queue",
    group: 'Queue',
    implies: ['queue.doctor.own'],
  },
  'queue.display.manage': {
    feature: 'appointments.core',
    label: 'Manage TV display',
    group: 'Queue',
  },

  // ── Consultation ──
  'consultation.conduct': {
    feature: 'patients.core',
    label: 'Conduct consultations',
    group: 'Consultation',
    scopes: ALL_SCOPES,
    implies: ['patients.clinical.edit'],
  },
  'prescriptions.create': {
    feature: 'patients.prescriptions',
    label: 'Write prescriptions',
    group: 'Consultation',
  },
  'prescriptions.library.manage': {
    feature: 'patients.prescriptions',
    label: 'Manage prescription library',
    group: 'Consultation',
  },

  // ── Billing (billing.invoices) ──
  'billing.desk.use': {
    feature: 'billing.invoices',
    label: 'Use the billing desk',
    group: 'Billing',
  },
  'billing.invoice.view': {
    feature: 'billing.invoices',
    label: 'View invoices',
    group: 'Billing',
    scopes: ALL_SCOPES,
  },
  'billing.invoice.edit': {
    feature: 'billing.invoices',
    label: 'Edit invoices',
    group: 'Billing',
    implies: ['billing.invoice.view'],
  },
  'billing.invoice.void': {
    feature: 'billing.invoices',
    label: 'Void invoices',
    group: 'Billing',
    implies: ['billing.invoice.view'],
    risk: 'high',
  },
  'billing.payment.collect': {
    feature: 'billing.invoices',
    label: 'Collect payments',
    group: 'Billing',
    implies: ['billing.invoice.view'],
  },
  'billing.refund.issue': {
    feature: 'billing.invoices',
    label: 'Issue refunds',
    group: 'Billing',
    implies: ['billing.invoice.view'],
    risk: 'high',
  },
  'billing.price.override': {
    feature: 'billing.invoices',
    label: 'Override prices',
    group: 'Billing',
    risk: 'high',
  },
  'billing.cash_close': {
    feature: 'billing.invoices',
    label: 'Close the cash drawer',
    group: 'Billing',
  },
  'billing.activity.view': {
    feature: 'billing.invoices',
    label: 'View billing activity',
    group: 'Billing',
  },

  // ── Discounts (billing.discounts) ──
  'billing.discount.apply': {
    feature: 'billing.discounts',
    label: 'Apply preset discounts',
    group: 'Discounts',
  },
  'billing.discount.custom': {
    feature: 'billing.discounts',
    label: 'Give custom discounts',
    group: 'Discounts',
    implies: ['billing.discount.apply'],
    risk: 'high',
  },

  // ── Expenses (billing.expenses) ──
  'expenses.view': {
    feature: 'billing.expenses',
    label: 'View expenses',
    group: 'Expenses',
  },
  'expenses.manage': {
    feature: 'billing.expenses',
    label: 'Record and edit expenses',
    group: 'Expenses',
    implies: ['expenses.view'],
  },

  // ── Commissions (billing.commissions) ──
  'earnings.own.view': {
    feature: 'billing.commissions',
    label: 'See own earnings',
    group: 'Commissions',
  },
  'earnings.all.view': {
    feature: 'billing.commissions',
    label: "See every doctor's earnings",
    group: 'Commissions',
    implies: ['earnings.own.view'],
  },
  'compensation.manage': {
    feature: 'billing.commissions',
    label: 'Manage salaries and commissions',
    group: 'Commissions',
    implies: ['earnings.all.view'],
    risk: 'high',
  },

  // ── Lab (dental.lab_orders) ──
  'lab.orders.view': {
    feature: 'dental.lab_orders',
    label: 'View lab orders',
    group: 'Lab',
    scopes: ALL_SCOPES,
  },
  'lab.orders.create': {
    feature: 'dental.lab_orders',
    label: 'Create lab orders',
    group: 'Lab',
    implies: ['lab.orders.view'],
  },
  'lab.billing.manage': {
    feature: 'dental.lab_orders',
    label: 'Manage lab billing',
    group: 'Lab',
  },
  'lab.catalog.manage': {
    feature: 'dental.lab_orders',
    label: 'Manage lab catalog',
    group: 'Lab',
  },
  'lab.payables.manage': {
    feature: 'dental.lab_orders',
    label: 'Manage lab payables',
    group: 'Lab',
  },
  'lab.links.manage': {
    feature: 'dental.lab_orders',
    label: 'Manage lab links',
    group: 'Lab',
  },
  'lab.templates.share': {
    feature: 'dental.lab_orders',
    label: 'Share lab order templates',
    group: 'Lab',
  },

  // ── Inventory (inventory.core) ──
  'inventory.view': {
    feature: 'inventory.core',
    label: 'View inventory',
    group: 'Inventory',
  },
  'inventory.stock.adjust': {
    feature: 'inventory.core',
    label: 'Adjust stock',
    group: 'Inventory',
    implies: ['inventory.view'],
  },
  'inventory.po.manage': {
    feature: 'inventory.core',
    label: 'Manage purchase orders',
    group: 'Inventory',
    implies: ['inventory.view'],
  },

  // ── Team ──
  'employees.view': {
    feature: CORE_FEATURE,
    label: 'View staff',
    group: 'Team',
  },
  'employees.manage': {
    feature: CORE_FEATURE,
    label: 'Manage staff',
    group: 'Team',
    implies: ['employees.view'],
  },
  'payroll.manage': {
    feature: 'hr.payroll',
    label: 'Manage payroll',
    group: 'Team',
    risk: 'high',
  },
  'leave.approve': {
    feature: 'hr.leave',
    label: 'Approve leave',
    group: 'Team',
  },

  // ── Reports ──
  'reports.clinical.view': {
    feature: 'reports.clinical',
    label: 'View clinical reports',
    group: 'Reports',
    scopes: ALL_SCOPES,
  },
  'reports.financial.view': {
    feature: 'reports.financial',
    label: 'View financial reports',
    group: 'Reports',
    scopes: ALL_SCOPES,
  },
  'reports.export': {
    feature: 'reports.exports',
    label: 'Export reports',
    group: 'Reports',
    risk: 'high',
  },
  'finance.overview.view': {
    feature: 'reports.financial',
    label: 'View finance overview',
    group: 'Reports',
  },

  // ── Admin (core, always on) ──
  'admin.features.manage': {
    feature: CORE_FEATURE,
    label: 'Turn clinic features on/off',
    group: 'Admin',
    risk: 'high',
  },
  'admin.roles.manage': {
    feature: CORE_FEATURE,
    label: 'Manage roles and permissions',
    group: 'Admin',
    risk: 'high',
  },
  'admin.users.manage': {
    feature: CORE_FEATURE,
    label: 'Manage users and their access',
    group: 'Admin',
    risk: 'high',
  },
  'admin.nav.manage': {
    feature: CORE_FEATURE,
    label: 'Customize the sidebar',
    group: 'Admin',
  },
  'admin.settings.manage': {
    feature: CORE_FEATURE,
    label: 'Manage clinic settings',
    group: 'Admin',
  },
  'admin.locations.manage': {
    feature: CORE_FEATURE,
    label: 'Manage locations',
    group: 'Admin',
  },
  'admin.audit.view': {
    feature: CORE_FEATURE,
    label: 'View the audit log',
    group: 'Admin',
  },
  'admin.theme.manage': {
    feature: CORE_FEATURE,
    label: 'Manage clinic theme and branding',
    group: 'Admin',
  },
  'notifications.settings.manage': {
    feature: CORE_FEATURE,
    label: 'Manage notification settings',
    group: 'Admin',
  },
});

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

/** Module order for the roles screen (and bundles). */
export const PERMISSION_GROUPS = [
  'Patients',
  'Appointments',
  'Queue',
  'Consultation',
  'Billing',
  'Discounts',
  'Expenses',
  'Commissions',
  'Lab',
  'Inventory',
  'Team',
  'Reports',
  'Admin',
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

/** A role's grant for one permission: a scope for scoped ones, `true` otherwise. */
export type Grant = Scope | true;

/** Granted permissions only — a missing key means no access (fail-closed). */
export type PermissionMap = Partial<Record<Permission, Grant>>;

export function isPermission(key: string): key is Permission {
  return Object.hasOwn(PERMISSIONS, key);
}

export function isScoped(perm: Permission): boolean {
  return !!PERMISSIONS[perm].scopes?.length;
}

/** The widest scope this permission supports (`org` for unscoped ones). */
export function widestScope(perm: Permission): Scope {
  const scopes = PERMISSIONS[perm].scopes;
  if (!scopes?.length) return 'org';
  return [...scopes].sort((a, b) => SCOPE_RANK[b] - SCOPE_RANK[a])[0];
}

/** The narrowest scope this permission supports. */
export function narrowestScope(perm: Permission): Scope {
  const scopes = PERMISSIONS[perm].scopes;
  if (!scopes?.length) return 'org';
  return [...scopes].sort((a, b) => SCOPE_RANK[a] - SCOPE_RANK[b])[0];
}

/** Grant giving the full reach of a permission (what owners get). */
export function fullGrant(perm: Permission): Grant {
  return isScoped(perm) ? widestScope(perm) : true;
}

/** The wider of two grants for the same permission. */
export function widerGrant(a: Grant | undefined, b: Grant): Grant {
  if (a === undefined) return b;
  if (a === true || b === true) return true;
  return SCOPE_RANK[a] >= SCOPE_RANK[b] ? a : b;
}

/**
 * Describes why a stored permission map is invalid, or returns null.
 * Unknown keys are rejected; scoped permissions need one of their scopes;
 * unscoped ones need `true`.
 */
export function validatePermissionMap(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'permissions must be an object of { permission: scope | true }';
  }
  const problems: string[] = [];
  for (const [key, grant] of Object.entries(value as Record<string, unknown>)) {
    if (!isPermission(key)) {
      problems.push(`unknown permission "${key}"`);
      continue;
    }
    const scopes = PERMISSIONS[key].scopes;
    if (scopes?.length) {
      if (typeof grant !== 'string' || !scopes.includes(grant as Scope)) {
        problems.push(`"${key}" needs one of: ${scopes.join(', ')}`);
      }
    } else if (grant !== true) {
      problems.push(`"${key}" must be true`);
    }
  }
  return problems.length ? problems.join('; ') : null;
}

/**
 * Turns a stored role permission map into granted permissions. Unknown keys
 * (including the legacy `canManageSettings`-style booleans) and `false` are
 * ignored. Never widens a grant: an unscoped value on a scoped permission
 * gets its narrowest scope.
 */
export function normalizeGrants(raw: unknown): PermissionMap {
  const out: PermissionMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPermission(key)) continue;
    const scopes = PERMISSIONS[key].scopes;
    if (scopes?.length) {
      if (typeof value === 'string' && scopes.includes(value as Scope)) {
        out[key] = value as Scope;
      } else if (value === true) {
        out[key] = narrowestScope(key);
      }
    } else if (
      value === true ||
      (typeof value === 'string' && SCOPES.includes(value as Scope))
    ) {
      out[key] = true;
    }
  }
  return out;
}

/**
 * Adds everything the granted permissions imply (transitively). An implied
 * scoped permission takes the granting permission's scope when it supports
 * it, otherwise its own narrowest scope; existing grants are only widened.
 */
export function expandImplies(grants: PermissionMap): PermissionMap {
  const out: PermissionMap = { ...grants };
  const queue = Object.keys(out) as Permission[];
  while (queue.length) {
    const perm = queue.shift()!;
    const grant = out[perm]!;
    for (const implied of PERMISSIONS[perm].implies ?? []) {
      if (!isPermission(implied)) continue;
      let next: Grant;
      if (!isScoped(implied)) next = true;
      else if (grant !== true && PERMISSIONS[implied].scopes!.includes(grant))
        next = grant;
      else next = narrowestScope(implied);
      const merged = widerGrant(out[implied], next);
      if (merged !== out[implied]) {
        out[implied] = merged;
        queue.push(implied);
      }
    }
  }
  return out;
}

/** Permissions whose feature is on (core permissions always are). */
export function filterByFeatures(
  grants: PermissionMap,
  enabledFeatures: ReadonlySet<string>,
): PermissionMap {
  const out: PermissionMap = {};
  for (const [key, grant] of Object.entries(grants) as [Permission, Grant][]) {
    const feature = PERMISSIONS[key].feature;
    if (feature === CORE_FEATURE || enabledFeatures.has(feature))
      out[key] = grant;
  }
  return out;
}
