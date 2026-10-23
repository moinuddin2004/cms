import { BUNDLES } from './bundles';
import { Permission, PERMISSION_GROUPS, PermissionMap } from './permissions';

/**
 * System role templates, seeded into every org (insert-missing only). The
 * old `clinic_admin / receptionist / doctor` become templates the clinic can
 * clone; Assistant and Accountant are extra starting points. Permissions
 * follow the design doc's "Permission matrix ki misaal".
 */
export interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  homeRoute: string;
  permissions: PermissionMap;
}

/**
 * Clinical acts an admin does not do by default (they clone Doctor for that).
 * `queue.doctor.any` is NOT here: the admin runs and force-completes any
 * doctor's queue (it implies `queue.doctor.own`, so the Admin also gets that
 * at resolution time).
 */
const NOT_FOR_ADMIN: readonly Permission[] = [
  'consultation.conduct',
  'prescriptions.create',
  'queue.doctor.own',
  'earnings.own.view',
];

function adminPermissions(): PermissionMap {
  const out: PermissionMap = {};
  for (const group of PERMISSION_GROUPS)
    Object.assign(out, BUNDLES[group].full);
  for (const p of NOT_FOR_ADMIN) delete out[p];
  return out;
}

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    key: 'admin',
    name: 'Admin',
    description: 'Runs the clinic: every module, settings, roles and users.',
    homeRoute: '/dashboard',
    permissions: adminPermissions(),
  },
  {
    key: 'doctor',
    name: 'Doctor',
    description:
      'Consults own patients: queue, clinical records, prescriptions, lab orders.',
    homeRoute: '/queue/doctor',
    permissions: {
      'patients.view': 'own',
      'patients.clinical.view': true,
      'patients.clinical.edit': true,
      'patients.chart.edit': true,
      'patients.documents.manage': true,
      'plans.manage': true,
      'appointments.view': 'own',
      'queue.doctor.own': true,
      'consultation.conduct': 'own',
      'prescriptions.create': true,
      'earnings.own.view': true,
      'lab.orders.view': 'own',
      'lab.orders.create': true,
      'reports.clinical.view': 'own',
    },
  },
  {
    key: 'receptionist',
    name: 'Receptionist',
    description:
      'Front desk: patients, bookings, check-in, queue board and billing desk.',
    homeRoute: '/appointments',
    permissions: {
      'patients.view': 'location',
      'patients.create': true,
      'patients.edit': true,
      'patients.price.view': true,
      'patients.documents.manage': true,
      'appointments.view': 'location',
      'appointments.book': true,
      'appointments.reschedule': true,
      'appointments.cancel': true,
      'queue.board.view': true,
      'queue.checkin': true,
      'queue.entry.manage': true,
      'queue.display.manage': true,
      'billing.desk.use': true,
      'billing.invoice.view': 'location',
      'billing.payment.collect': true,
      'billing.discount.apply': true,
      'lab.orders.view': 'location',
    },
  },
  {
    key: 'assistant',
    name: 'Assistant',
    description:
      'Chairside help: patients at this location, charting, check-in, stock.',
    homeRoute: '/appointments',
    permissions: {
      'patients.view': 'location',
      'patients.clinical.view': true,
      'patients.chart.edit': true,
      'appointments.view': 'location',
      'appointments.book': true,
      'queue.board.view': true,
      'queue.checkin': true,
      'inventory.view': true,
      'lab.orders.view': 'location',
    },
  },
  {
    key: 'accountant',
    name: 'Accountant',
    description:
      'Money: invoices, voids, refunds, expenses, earnings and financial reports.',
    homeRoute: '/billing',
    permissions: {
      'patients.price.view': true,
      'billing.desk.use': true,
      'billing.invoice.view': 'location',
      'billing.invoice.edit': true,
      'billing.invoice.void': true,
      'billing.payment.collect': true,
      'billing.refund.issue': true,
      'billing.cash_close': true,
      'billing.activity.view': true,
      'expenses.view': true,
      'expenses.manage': true,
      'earnings.all.view': true,
      'reports.financial.view': 'location',
      'finance.overview.view': true,
      'reports.export': true,
      'lab.billing.manage': true,
      'lab.payables.manage': true,
    },
  },
];

/** Slug a template's role gets (kept apart from clinic-made role slugs). */
export const templateSlug = (key: string) => `system_${key}`;
