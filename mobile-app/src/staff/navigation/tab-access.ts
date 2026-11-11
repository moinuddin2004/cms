import type { PermissionRequirement } from '@/staff/features/access';

/** The five staff tabs, in tab-bar order (docs/02 §4, docs/05 §7). */
export type StaffTabName = 'today' | 'queue' | 'patients' | 'schedule' | 'more';

export interface StaffTabSpec {
  name: StaffTabName;
  title: string;
  /** Any-of. `undefined` = always shown. */
  can?: PermissionRequirement;
}

export const STAFF_TABS: readonly StaffTabSpec[] = [
  {
    name: 'today',
    title: 'Today',
    can: ['appointments.view', 'billing.invoice.view', 'finance.overview.view'],
  },
  { name: 'queue', title: 'Queue', can: ['queue.doctor.own', 'queue.board.view'] },
  { name: 'patients', title: 'Patients', can: 'patients.view' },
  { name: 'schedule', title: 'Schedule', can: 'appointments.view' },
  { name: 'more', title: 'More' },
];

/** Order the app opens on: the first allowed one wins (docs/10 M1-02 step 1). */
const INITIAL_ORDER: readonly StaffTabName[] = ['queue', 'today', 'patients', 'schedule', 'more'];

type Can = (perm?: PermissionRequirement | null) => boolean;

/** Tabs this user may see. Pure, so the permission matrix is unit-tested. `More` is always there. */
export function visibleTabs(can: Can): StaffTabName[] {
  return STAFF_TABS.filter((t) => can(t.can)).map((t) => t.name);
}

/** The tab the app opens on for this user. */
export function initialTab(can: Can): StaffTabName {
  const visible = new Set(visibleTabs(can));
  return INITIAL_ORDER.find((n) => visible.has(n)) ?? 'more';
}
