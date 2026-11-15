import type { CloseDecision, EntryView } from '../types/queue.types';

/** What the doctor has chosen for one leftover patient so far ('' = not decided). */
export interface DecisionDraft {
  action: 'cancel' | 'transfer' | '';
  toDoctorId: string;
}

export const EMPTY_DRAFT: DecisionDraft = { action: '', toDoctorId: '' };

/**
 * The patients that need a decision before the session may close
 * (`closeSession` in the backend orchestrator): waiting, skipped and on hold.
 * Oldest check-in first.
 */
export function closeLeftovers(entries: readonly EntryView[]): EntryView[] {
  return entries
    .filter((e) => e.status === 'waiting' || e.status === 'skipped' || e.status === 'on_hold')
    .sort((a, b) => Date.parse(a.checkedInAt) - Date.parse(b.checkedInAt));
}

/**
 * Only a waiting patient can move to another doctor (skipped / on hold must be
 * cancelled), and only when another doctor exists to receive them.
 */
export const canTransferEntry = (entry: EntryView, hasTargets: boolean) =>
  hasTargets && entry.status === 'waiting';

/** The draft in force: an entry that can only be cancelled needs no tap. */
export function effectiveDraft(
  entry: EntryView,
  draft: DecisionDraft | undefined,
  hasTargets: boolean,
): DecisionDraft {
  if (!canTransferEntry(entry, hasTargets)) return { action: 'cancel', toDoctorId: '' };
  return draft ?? EMPTY_DRAFT;
}

/**
 * The request body for the current leftovers, or null while any is undecided.
 * Built from the LIVE leftovers, so a patient who arrived while the sheet was
 * open blocks the submit instead of being left out.
 */
export function buildDecisions(
  leftovers: readonly EntryView[],
  drafts: Readonly<Record<string, DecisionDraft>>,
  hasTargets: boolean,
): CloseDecision[] | null {
  const out: CloseDecision[] = [];
  for (const entry of leftovers) {
    const d = effectiveDraft(entry, drafts[entry.id], hasTargets);
    if (d.action === 'cancel') out.push({ entryId: entry.id, action: 'cancel' });
    else if (d.action === 'transfer' && d.toDoctorId)
      out.push({ entryId: entry.id, action: 'transfer', toDoctorId: d.toDoctorId });
    else return null;
  }
  return out;
}
