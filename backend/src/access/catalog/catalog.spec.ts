import {
  expandImplies,
  filterByFeatures,
  isPermission,
  normalizeGrants,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSIONS,
  validatePermissionMap,
} from './permissions';
import { BUNDLES, matchBundle } from './bundles';
import { ROLE_TEMPLATES } from './templates';

import type { Permission, PermissionGroup } from './permissions';

/** The design doc's permission catalog table, verbatim. */
const DOC_KEYS = [
  'patients.view',
  'patients.create',
  'patients.edit',
  'patients.delete',
  'patients.export',
  'patients.price.view',
  'patients.clinical.view',
  'patients.clinical.edit',
  'patients.documents.manage',
  'patients.chart.edit',
  'plans.manage',
  'plans.templates.manage',
  'appointments.view',
  'appointments.book',
  'appointments.reschedule',
  'appointments.cancel',
  'appointments.override_rules',
  'queue.board.view',
  'queue.checkin',
  'queue.entry.manage',
  'queue.entry.reprioritize',
  'queue.doctor.own',
  'queue.doctor.any',
  'queue.display.manage',
  'consultation.conduct',
  'prescriptions.create',
  'prescriptions.library.manage',
  'billing.desk.use',
  'billing.invoice.view',
  'billing.invoice.edit',
  'billing.invoice.void',
  'billing.payment.collect',
  'billing.refund.issue',
  'billing.price.override',
  'billing.cash_close',
  'billing.activity.view',
  'billing.discount.apply',
  'billing.discount.custom',
  'expenses.view',
  'expenses.manage',
  'earnings.own.view',
  'earnings.all.view',
  'compensation.manage',
  'lab.orders.view',
  'lab.orders.create',
  'lab.billing.manage',
  'lab.catalog.manage',
  'lab.payables.manage',
  'lab.links.manage',
  'lab.templates.share',
  'inventory.view',
  'inventory.stock.adjust',
  'inventory.po.manage',
  'employees.view',
  'employees.manage',
  'payroll.manage',
  'leave.approve',
  'reports.clinical.view',
  'reports.financial.view',
  'reports.export',
  'finance.overview.view',
  'admin.features.manage',
  'admin.roles.manage',
  'admin.users.manage',
  'admin.nav.manage',
  'admin.settings.manage',
  'admin.locations.manage',
  'admin.audit.view',
  'notifications.settings.manage',
];

/**
 * Front-desk bundles may also grant a permission listed under another module:
 * the Queue bundle links patients to the app (M2-12).
 */
const CROSS_MODULE_BUNDLE_GRANTS: Partial<
  Record<PermissionGroup, readonly Permission[]>
> = {
  Queue: ['patients.app_link.manage'],
};

describe('permission catalog', () => {
  it('contains every key from the design doc, plus admin.theme.manage and the patient-app keys', () => {
    for (const key of DOC_KEYS) expect(isPermission(key)).toBe(true);
    expect(isPermission('admin.theme.manage')).toBe(true);
    expect(PERMISSION_KEYS.filter((k) => !DOC_KEYS.includes(k))).toEqual([
      'patients.app_link.manage',
      'appointments.requests.manage',
      'admin.theme.manage',
    ]);
  });

  it('maps both patient-app permissions to the patient_app feature', () => {
    expect(PERMISSIONS['patients.app_link.manage'].feature).toBe('patient_app');
    expect(PERMISSIONS['appointments.requests.manage'].feature).toBe(
      'patient_app',
    );
  });

  it("marks the doc's (s) permissions as scoped", () => {
    const scoped = PERMISSION_KEYS.filter((k) => PERMISSIONS[k].scopes?.length);
    expect(scoped.sort()).toEqual(
      [
        'patients.view',
        'appointments.view',
        'consultation.conduct',
        'billing.invoice.view',
        'lab.orders.view',
        'reports.clinical.view',
        'reports.financial.view',
      ].sort(),
    );
  });

  it('only implies known permissions and uses known groups', () => {
    for (const key of PERMISSION_KEYS) {
      for (const implied of PERMISSIONS[key].implies ?? []) {
        expect(isPermission(implied)).toBe(true);
      }
      expect(PERMISSION_GROUPS).toContain(PERMISSIONS[key].group);
    }
  });
});

describe('validatePermissionMap', () => {
  it('accepts scopes for scoped and true for unscoped permissions', () => {
    expect(
      validatePermissionMap({
        'patients.view': 'own',
        'billing.desk.use': true,
      }),
    ).toBeNull();
    expect(validatePermissionMap({})).toBeNull();
  });

  it('rejects unknown keys, legacy booleans and wrong values', () => {
    expect(validatePermissionMap({ canManageSettings: true })).toMatch(
      /unknown/,
    );
    expect(validatePermissionMap({ 'patients.view': true })).toMatch(
      /needs one of/,
    );
    expect(validatePermissionMap({ 'patients.view': 'everywhere' })).toMatch(
      /needs one of/,
    );
    expect(validatePermissionMap({ 'billing.desk.use': 'org' })).toMatch(
      /must be true/,
    );
    expect(validatePermissionMap({ 'billing.desk.use': false })).toMatch(
      /must be true/,
    );
    expect(validatePermissionMap(null)).toMatch(/object/);
    expect(validatePermissionMap(['patients.view'])).toMatch(/object/);
  });
});

describe('normalizeGrants', () => {
  it('ignores legacy flags, unknown keys and false (fail-closed)', () => {
    expect(
      normalizeGrants({
        canManageSettings: true,
        canConsult: true,
        'nope.nope': true,
        'billing.desk.use': false,
      }),
    ).toEqual({});
    expect(normalizeGrants(undefined)).toEqual({});
  });

  it('never widens: true on a scoped permission becomes its narrowest scope', () => {
    expect(normalizeGrants({ 'patients.view': true })).toEqual({
      'patients.view': 'own',
    });
    expect(normalizeGrants({ 'patients.view': 'location' })).toEqual({
      'patients.view': 'location',
    });
  });
});

describe('expandImplies', () => {
  it('adds implied permissions transitively', () => {
    const out = expandImplies({ 'compensation.manage': true });
    expect(out).toEqual({
      'compensation.manage': true,
      'earnings.all.view': true,
      'earnings.own.view': true,
    });
  });

  it('passes the granting scope on, or the narrowest one from unscoped grants', () => {
    expect(expandImplies({ 'consultation.conduct': 'location' })).toMatchObject(
      {
        'patients.clinical.edit': true,
        'patients.clinical.view': true,
      },
    );
    expect(
      expandImplies({ 'billing.invoice.void': true })['billing.invoice.view'],
    ).toBe('own');
  });

  it('keeps an explicit wider grant', () => {
    const out = expandImplies({
      'billing.invoice.void': true,
      'billing.invoice.view': 'org',
    });
    expect(out['billing.invoice.view']).toBe('org');
  });
});

describe('filterByFeatures', () => {
  it('drops permissions of disabled features and keeps core ones', () => {
    const out = filterByFeatures(
      {
        'billing.desk.use': true,
        'patients.view': 'org',
        'admin.roles.manage': true,
      },
      new Set(['patients.core']),
    );
    expect(out).toEqual({ 'patients.view': 'org', 'admin.roles.manage': true });
  });
});

describe('bundles and templates', () => {
  it('every bundle and template is a valid permission map', () => {
    for (const group of PERMISSION_GROUPS) {
      for (const level of ['none', 'basic', 'full'] as const) {
        expect(validatePermissionMap(BUNDLES[group][level])).toBeNull();
        for (const key of Object.keys(BUNDLES[group][level])) {
          const permission = key as Permission;
          const allowed =
            PERMISSIONS[permission].group === group ||
            CROSS_MODULE_BUNDLE_GRANTS[group]?.includes(permission);
          expect(allowed).toBe(true);
        }
      }
    }
    for (const t of ROLE_TEMPLATES)
      expect(validatePermissionMap(t.permissions)).toBeNull();
  });

  it('full bundles reach the widest scope', () => {
    expect(BUNDLES.Patients.full['patients.view']).toBe('org');
    expect(BUNDLES.Patients.none).toEqual({});
  });

  it('matchBundle recognises a level', () => {
    expect(matchBundle('Discounts', { 'billing.discount.apply': true })).toBe(
      'basic',
    );
    expect(matchBundle('Discounts', {})).toBe('none');
    expect(
      matchBundle('Discounts', { 'billing.discount.custom': true }),
    ).toBeNull();
  });

  it('templates follow the doc matrix', () => {
    const t = Object.fromEntries(
      ROLE_TEMPLATES.map((r) => [r.key, r.permissions]),
    );
    expect(Object.keys(t)).toEqual([
      'admin',
      'doctor',
      'receptionist',
      'assistant',
      'accountant',
    ]);
    expect(t.admin['patients.view']).toBe('org');
    expect(t.admin['billing.discount.custom']).toBe(true);
    expect(t.admin['queue.entry.reprioritize']).toBe(true);
    expect(t.admin['reports.financial.view']).toBe('org');
    expect(t.admin['earnings.own.view']).toBeUndefined();
    expect(t.doctor['patients.view']).toBe('own');
    expect(t.doctor['earnings.own.view']).toBe(true);
    expect(t.doctor['patients.price.view']).toBeUndefined();
    expect(t.receptionist['patients.view']).toBe('location');
    expect(t.receptionist['billing.desk.use']).toBe(true);
    expect(t.receptionist['billing.invoice.void']).toBeUndefined();
    expect(t.assistant['appointments.book']).toBe(true);
    expect(t.assistant['patients.price.view']).toBeUndefined();
    expect(t.accountant['billing.invoice.void']).toBe(true);
    expect(t.accountant['reports.financial.view']).toBe('location');
    expect(t.accountant['patients.view']).toBeUndefined();
  });
});
