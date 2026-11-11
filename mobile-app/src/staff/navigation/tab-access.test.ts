import type { PermissionRequirement } from '@/staff/features/access';

import { initialTab, STAFF_TABS, visibleTabs } from './tab-access';

/** An any-of `can` over a fixed grant list — the same contract as `useAccess().can`. */
function canWith(granted: string[]) {
  const has = (p: string) => granted.includes(p);
  return (perm?: PermissionRequirement | null) => {
    if (perm == null) return true;
    if (typeof perm === 'string') return has(perm);
    return perm.length === 0 || perm.some(has);
  };
}

const ALL = STAFF_TABS.flatMap((t) => (t.can === undefined ? [] : [t.can].flat())) as string[];

describe('staff tab permission matrix', () => {
  it('doctor-only: Queue + Patients + More', () => {
    const can = canWith(['queue.doctor.own', 'patients.view']);
    expect(visibleTabs(can)).toEqual(['queue', 'patients', 'more']);
    expect(initialTab(can)).toBe('queue');
  });

  it('receptionist: Queue + Patients + Schedule + More (and Today via appointments.view)', () => {
    const can = canWith(['queue.board.view', 'patients.view', 'appointments.view']);
    expect(visibleTabs(can)).toEqual(['today', 'queue', 'patients', 'schedule', 'more']);
  });

  it('owner: all five', () => {
    expect(visibleTabs(canWith(ALL))).toEqual(['today', 'queue', 'patients', 'schedule', 'more']);
  });

  it('nobody: More only, and it opens there', () => {
    const can = canWith([]);
    expect(visibleTabs(can)).toEqual(['more']);
    expect(initialTab(can)).toBe('more');
  });

  it('Today opens on any one of its three permissions', () => {
    for (const perm of ['appointments.view', 'billing.invoice.view', 'finance.overview.view']) {
      expect(visibleTabs(canWith([perm]))).toContain('today');
    }
  });

  it('opens on Today when there is no queue access', () => {
    expect(initialTab(canWith(['finance.overview.view', 'patients.view']))).toBe('today');
  });
});
