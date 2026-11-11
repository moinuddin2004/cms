import type { PermissionKey } from '@/staff/features/access';

import type { EntryStatus, EntryView, SessionStatus, SessionView } from '../types/queue.types';
import { availableEntryActions, type EntryActionId } from './entry-actions';

const STATUSES: EntryStatus[] = [
  'waiting',
  'called',
  'in_consultation',
  'on_hold',
  'skipped',
  'completed',
  'cancelled',
  'transferred',
  'aborted',
];

function entry(status: EntryStatus, withPatient = true): EntryView {
  return {
    id: 'e1',
    sessionId: 's1',
    token: 'A-001',
    tokenNumber: 1,
    queueType: 'walk_in',
    status,
    priorityClass: 'normal',
    urgentReason: null,
    urgentSince: null,
    patient: withPatient
      ? { id: 'p1', fullName: 'Ali Raza', phone: '0300', patientNumber: 'P-1' }
      : null,
    appointmentId: null,
    scheduledStart: null,
    reasonForVisit: null,
    checkedInAt: '2026-11-11T05:00:00.000Z',
    sortAnchorAt: '2026-11-11T05:00:00.000Z',
    calledAt: null,
    consultationStartedAt: null,
    holdStartedAt: null,
    returnedFromHoldAt: null,
    skippedAt: null,
    finishedAt: null,
    convertedFromApptId: null,
    transferredFromId: null,
    version: 3,
  };
}

function session(status: SessionStatus = 'open'): SessionView {
  return {
    id: 's1',
    organizationId: 'o1',
    locationId: 'l1',
    doctorId: 'd1',
    doctorName: 'Dr Sana',
    serviceDate: '2026-11-11',
    status,
    tokenPrefix: 'A',
    smartQueueEnabled: false,
    pauseReason: null,
    startedAt: null,
    closedAt: null,
    lastCallReason: null,
    eventSeq: 1,
    version: 1,
  };
}

const can =
  (...granted: PermissionKey[]) =>
  (perm: PermissionKey) =>
    granted.includes(perm);

const ALL = can(
  'queue.doctor.own',
  'queue.entry.manage',
  'queue.entry.reprioritize',
  'queue.checkin',
  'patients.view',
);

function run(
  status: EntryStatus,
  viewer: 'doctor' | 'board',
  canFn: (p: PermissionKey) => boolean,
  sessionStatus: SessionStatus = 'open',
  withPatient = true,
): EntryActionId[] {
  return availableEntryActions(entry(status, withPatient), session(sessionStatus), canFn, viewer);
}

describe('availableEntryActions — doctor viewer (S-02a)', () => {
  const doctor = can('queue.doctor.own');
  const doctorWithFile = can('queue.doctor.own', 'patients.view');

  it.each<[EntryStatus, EntryActionId[]]>([
    ['waiting', ['select']],
    ['called', ['start', 'recall', 'undo-call', 'skip']],
    ['in_consultation', ['complete', 'send-for-test', 'abort']],
    ['on_hold', []],
    ['skipped', []],
    ['completed', []],
    ['cancelled', []],
    ['transferred', []],
    ['aborted', []],
  ])('%s with queue.doctor.own only → %j', (status, expected) => {
    expect(run(status, 'doctor', doctor)).toEqual(expected);
  });

  it('adds "patient-file" on the current card when patients.view is held', () => {
    expect(run('called', 'doctor', doctorWithFile)).toEqual([
      'start',
      'recall',
      'undo-call',
      'skip',
      'patient-file',
    ]);
    expect(run('in_consultation', 'doctor', doctorWithFile)).toEqual([
      'complete',
      'send-for-test',
      'abort',
      'patient-file',
    ]);
  });

  it('never offers the patient file for non-current statuses', () => {
    for (const status of STATUSES) {
      if (status === 'called' || status === 'in_consultation') continue;
      expect(run(status, 'doctor', ALL)).not.toContain('patient-file');
    }
  });

  it('never offers the ticket to the doctor viewer', () => {
    for (const status of STATUSES) {
      expect(run(status, 'doctor', ALL)).not.toContain('show-ticket');
    }
  });

  it('without queue.doctor.own only skip (any member) remains on a called entry', () => {
    expect(run('called', 'doctor', can())).toEqual(['skip']);
    expect(run('in_consultation', 'doctor', can())).toEqual([]);
    expect(run('waiting', 'doctor', can())).toEqual([]);
  });

  it('select needs an open session', () => {
    for (const s of ['waiting_for_doctor', 'paused', 'closed'] as const) {
      expect(run('waiting', 'doctor', doctor, s)).toEqual([]);
    }
    expect(run('waiting', 'doctor', doctor, 'open')).toEqual(['select']);
  });

  it('hides the patient file when the entry has no patient', () => {
    expect(run('called', 'doctor', doctorWithFile, 'open', false)).not.toContain('patient-file');
  });

  it('ignores board-only permissions', () => {
    const boardOnly = can('queue.entry.manage', 'queue.entry.reprioritize', 'queue.checkin');
    expect(run('waiting', 'doctor', boardOnly)).toEqual([]);
    expect(run('on_hold', 'doctor', boardOnly)).toEqual([]);
  });
});

describe('availableEntryActions — board viewer (S-02b)', () => {
  const manage = can('queue.entry.manage');
  const reprioritize = can('queue.entry.reprioritize');
  const checkin = can('queue.checkin');
  const file = can('patients.view');

  // Every permission set x every status, against an independently written table.
  const PERMS = [
    'queue.entry.manage',
    'queue.entry.reprioritize',
    'queue.checkin',
    'patients.view',
  ] as const satisfies readonly PermissionKey[];

  function expected(status: EntryStatus, has: (p: PermissionKey) => boolean): EntryActionId[] {
    const out: EntryActionId[] = [];
    if (status === 'waiting' && has('queue.entry.reprioritize')) out.push('mark-urgent');
    if (status === 'waiting' && has('queue.entry.manage')) out.push('transfer');
    if (status === 'called' && has('queue.entry.manage')) out.push('skip');
    if (status === 'skipped' && has('queue.entry.manage')) out.push('rejoin');
    if (status === 'on_hold' && has('queue.checkin')) out.push('return-from-test');
    if (
      (status === 'waiting' || status === 'skipped' || status === 'on_hold') &&
      has('queue.entry.manage')
    ) {
      out.push('cancel');
    }
    if (has('patients.view')) out.push('patient-file');
    out.push('show-ticket');
    return out;
  }

  it('matches the table for every status x every permission combination', () => {
    for (let mask = 0; mask < 1 << PERMS.length; mask++) {
      const granted = PERMS.filter((_, i) => mask & (1 << i));
      const canFn = can(...granted);
      for (const status of STATUSES) {
        expect({ status, granted, actions: run(status, 'board', canFn) }).toEqual({
          status,
          granted,
          actions: expected(status, canFn),
        });
      }
    }
  });

  it('with no permissions only the ticket remains', () => {
    expect(run('waiting', 'board', can())).toEqual(['show-ticket']);
    expect(run('skipped', 'board', can())).toEqual(['show-ticket']);
    expect(run('called', 'board', can())).toEqual(['show-ticket']);
    expect(run('on_hold', 'board', can())).toEqual(['show-ticket']);
    expect(run('completed', 'board', can())).toEqual(['show-ticket']);
  });

  it('spot checks: each permission unlocks only its own actions', () => {
    expect(run('waiting', 'board', reprioritize)).toEqual(['mark-urgent', 'show-ticket']);
    expect(run('waiting', 'board', manage)).toEqual(['transfer', 'cancel', 'show-ticket']);
    expect(run('on_hold', 'board', checkin)).toEqual(['return-from-test', 'show-ticket']);
    expect(run('skipped', 'board', manage)).toEqual(['rejoin', 'cancel', 'show-ticket']);
    expect(run('called', 'board', manage)).toEqual(['skip', 'show-ticket']);
    expect(run('completed', 'board', file)).toEqual(['patient-file', 'show-ticket']);
  });

  it('terminal statuses offer no mutation, even with every permission', () => {
    for (const status of ['completed', 'cancelled', 'transferred', 'aborted'] as const) {
      expect(run(status, 'board', ALL)).toEqual(['patient-file', 'show-ticket']);
    }
  });

  it('never offers skip on waiting, nor transfer on skipped', () => {
    expect(run('waiting', 'board', ALL)).not.toContain('skip');
    expect(run('skipped', 'board', ALL)).not.toContain('transfer');
  });

  it('hides mark-urgent when the entry is already urgent', () => {
    const urgent = { ...entry('waiting'), priorityClass: 'authorized_urgent' as const };
    expect(availableEntryActions(urgent, session(), ALL, 'board')).not.toContain('mark-urgent');
  });

  it('in_consultation offers no board mutation', () => {
    expect(run('in_consultation', 'board', ALL)).toEqual(['patient-file', 'show-ticket']);
  });

  it('is independent of the session status', () => {
    for (const s of ['waiting_for_doctor', 'open', 'paused', 'closed'] as const) {
      expect(run('waiting', 'board', ALL, s)).toEqual(run('waiting', 'board', ALL, 'open'));
    }
  });

  it('hides the patient file when the entry has no patient', () => {
    expect(run('waiting', 'board', ALL, 'open', false)).not.toContain('patient-file');
    expect(run('waiting', 'board', ALL, 'open', false)).toContain('show-ticket');
  });
});
