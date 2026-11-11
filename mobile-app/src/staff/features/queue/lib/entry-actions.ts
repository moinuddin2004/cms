import type { PermissionKey } from '@/staff/features/access';

import type { EntryStatus, EntryView, SessionView } from '../types/queue.types';

/**
 * Which actions a queue entry offers, as ids the UI maps to buttons. Pure:
 * status validity x permission, exactly as the S-02a "current card" table and
 * the S-02b "row ActionSheet" table in docs/06. The caller passes `can` from
 * `useAccess()`. Permission-gated actions are hidden, never disabled (docs/04 §11).
 */

export type EntryActionId =
  | 'select'
  | 'start'
  | 'recall'
  | 'undo-call'
  | 'skip'
  | 'send-for-test'
  | 'complete'
  | 'abort'
  | 'mark-urgent'
  | 'transfer'
  | 'rejoin'
  | 'return-from-test'
  | 'cancel'
  | 'patient-file'
  | 'show-ticket';

export type EntryViewer = 'doctor' | 'board';

export type CanFn = (perm: PermissionKey) => boolean;

/** `null` = any member (the server decides); otherwise the required permission. */
interface Rule {
  id: EntryActionId;
  statuses: readonly EntryStatus[];
  perm: PermissionKey | null;
}

/** S-02a. Primary action first. Skip is "any member" on the doctor screen. */
const DOCTOR_RULES: readonly Rule[] = [
  { id: 'start', statuses: ['called'], perm: 'queue.doctor.own' },
  { id: 'complete', statuses: ['in_consultation'], perm: 'queue.doctor.own' },
  { id: 'recall', statuses: ['called'], perm: 'queue.doctor.own' },
  { id: 'undo-call', statuses: ['called'], perm: 'queue.doctor.own' },
  { id: 'skip', statuses: ['called'], perm: null },
  { id: 'send-for-test', statuses: ['in_consultation'], perm: 'queue.doctor.own' },
  { id: 'abort', statuses: ['in_consultation'], perm: 'queue.doctor.own' },
  // Waiting row "Call this patient".
  { id: 'select', statuses: ['waiting'], perm: 'queue.doctor.own' },
];

/** S-02b. Skip needs `queue.entry.manage` here, unlike the doctor screen. */
const BOARD_RULES: readonly Rule[] = [
  { id: 'mark-urgent', statuses: ['waiting'], perm: 'queue.entry.reprioritize' },
  { id: 'transfer', statuses: ['waiting'], perm: 'queue.entry.manage' },
  { id: 'skip', statuses: ['called'], perm: 'queue.entry.manage' },
  { id: 'rejoin', statuses: ['skipped'], perm: 'queue.entry.manage' },
  { id: 'return-from-test', statuses: ['on_hold'], perm: 'queue.checkin' },
  {
    id: 'cancel',
    statuses: ['waiting', 'skipped', 'on_hold'],
    perm: 'queue.entry.manage',
  },
];

/** The doctor's "Patient file" button sits on the current card only. */
const DOCTOR_PATIENT_FILE_STATUSES: readonly EntryStatus[] = ['called', 'in_consultation'];

export function availableEntryActions(
  entry: EntryView,
  session: SessionView,
  can: CanFn,
  viewer: EntryViewer,
): EntryActionId[] {
  const rules = viewer === 'doctor' ? DOCTOR_RULES : BOARD_RULES;
  const out: EntryActionId[] = [];

  for (const rule of rules) {
    if (!rule.statuses.includes(entry.status)) continue;
    if (rule.perm !== null && !can(rule.perm)) continue;
    // The server refuses a call unless the session is open (SESSION_NOT_OPEN).
    if (rule.id === 'select' && session.status !== 'open') continue;
    // Already urgent: nothing left to mark.
    if (rule.id === 'mark-urgent' && entry.priorityClass === 'authorized_urgent') continue;
    out.push(rule.id);
  }

  // Opening the patient's file needs a patient on the entry and `patients.view`.
  const hasFile =
    entry.patient !== null &&
    can('patients.view') &&
    (viewer === 'board' || DOCTOR_PATIENT_FILE_STATUSES.includes(entry.status));
  if (hasFile) out.push('patient-file');

  // The ticket is available on the board for every status.
  if (viewer === 'board') out.push('show-ticket');

  return out;
}
