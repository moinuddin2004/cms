import type { PermissionKey } from '@/staff/features/access';

import { availableEntryActions, type EntryActionId } from '../../lib/entry-actions';
import type { EntryStatus, EntryView, SessionView } from '../../types/queue.types';
import { BOARD_ACTION_LABELS, sheetActionIds } from './entry-sheet-actions';

const session = { id: 's', status: 'open' } as SessionView;
const entryOf = (status: EntryStatus, priorityClass: EntryView['priorityClass'] = 'normal') =>
  ({ id: 'e', status, priorityClass, patient: { id: 'p' } }) as EntryView;

const ALL: PermissionKey[] = [
  'queue.entry.reprioritize',
  'queue.entry.manage',
  'queue.checkin',
  'patients.view',
];

/** The row ActionSheet items the board shows for a status and a permission set (S-02b table). */
const items = (
  status: EntryStatus,
  perms: PermissionKey[],
  priority: EntryView['priorityClass'] = 'normal',
  canMutate = true,
): string[] =>
  sheetActionIds(
    availableEntryActions(entryOf(status, priority), session, (p) => perms.includes(p), 'board'),
    canMutate,
  ).map((id) => BOARD_ACTION_LABELS[id]);

describe('board row ActionSheet (status x permission)', () => {
  it('waiting: urgent, transfer, cancel, file, ticket', () => {
    expect(items('waiting', ALL)).toEqual([
      'Mark urgent',
      'Transfer to doctor',
      'Cancel visit',
      'Patient file',
      'Show ticket',
    ]);
  });

  it('hides "Mark urgent" when the entry is already urgent', () => {
    expect(items('waiting', ALL, 'authorized_urgent')).not.toContain('Mark urgent');
  });

  it('called: skip; skipped: rejoin + cancel; on_hold: back from test + cancel', () => {
    expect(items('called', ALL)).toEqual(['Skip', 'Patient file', 'Show ticket']);
    expect(items('skipped', ALL)).toEqual(['Rejoin queue', 'Cancel visit', 'Patient file', 'Show ticket']);
    expect(items('on_hold', ALL)).toEqual([
      'Back from test',
      'Cancel visit',
      'Patient file',
      'Show ticket',
    ]);
  });

  it('in_consultation and finished states only offer file + ticket', () => {
    for (const s of ['in_consultation', 'completed', 'cancelled'] as const) {
      expect(items(s, ALL)).toEqual(['Patient file', 'Show ticket']);
    }
  });

  it('hides permission-gated items without the permission', () => {
    expect(items('waiting', ['queue.entry.manage'])).toEqual([
      'Transfer to doctor',
      'Cancel visit',
      'Show ticket',
    ]);
    expect(items('on_hold', ['queue.entry.manage'])).toEqual(['Cancel visit', 'Show ticket']);
    expect(items('waiting', [])).toEqual(['Show ticket']);
  });

  it('offline keeps only the read-only items', () => {
    expect(items('waiting', ALL, 'normal', false)).toEqual(['Patient file', 'Show ticket']);
  });

  it('never offers a doctor-screen action on the board', () => {
    const doctorOnly: EntryActionId[] = ['select', 'start', 'recall', 'undo-call', 'send-for-test', 'complete', 'abort'];
    for (const s of ['waiting', 'called', 'in_consultation', 'on_hold', 'skipped'] as const) {
      const ids = availableEntryActions(entryOf(s), session, () => true, 'board');
      for (const bad of doctorOnly) expect(ids).not.toContain(bad);
    }
  });
});
