import type { EntryActionId } from '../../lib/entry-actions';

/**
 * Row ActionSheet content for the board (S-02b table). Pure: the caller has
 * already filtered by status x permission (`availableEntryActions`); this adds
 * the offline rule (changes are disabled, reading the ticket / file is not)
 * and the labels, in the table's order.
 */

export const BOARD_ACTION_LABELS: Record<EntryActionId, string> = {
  'mark-urgent': 'Mark urgent',
  transfer: 'Transfer to doctor',
  skip: 'Skip',
  rejoin: 'Rejoin queue',
  'return-from-test': 'Back from test',
  cancel: 'Cancel visit',
  'patient-file': 'Patient file',
  'show-ticket': 'Show ticket',
  // Doctor-screen actions: never offered on the board.
  select: 'Call this patient',
  start: 'Start',
  recall: 'Recall',
  'undo-call': 'Undo call',
  'send-for-test': 'Send for test',
  complete: 'Done',
  abort: 'Abort',
};

const READ_ONLY: ReadonlySet<EntryActionId> = new Set(['patient-file', 'show-ticket']);

/** Offline keeps only the actions that read data. */
export function sheetActionIds(available: EntryActionId[], canMutate: boolean): EntryActionId[] {
  return canMutate ? available : available.filter((id) => READ_ONLY.has(id));
}
