import { SelectionReason } from '../enums/queue.enums';

/**
 * Patient Selection Engine — a PURE function: no DB, no clock, no config of
 * its own. The orchestrator hands it the session's WAITING entries, the
 * transaction's `now` and the effective policy; it returns who to call next
 * and why. Priority is never stored: "due" changes with time, so it is
 * recomputed on every Call Next.
 */

export type Candidate = {
  id: string;
  token: number;
  type: 'APPOINTMENT' | 'WALK_IN';
  urgentSince?: Date | null;
  scheduledStart?: Date | null;
  checkedInAt: Date;
  sortAnchorAt: Date;
  returnedFromHoldAt?: Date | null;
};

export type SelectionPolicy = {
  smartQueueEnabled: boolean;
  earlyWindowMin: number;
  lateGraceMin: number;
  starvationMin: number;
};

export type Decision = {
  entryId: string;
  reason: Exclude<SelectionReason, 'MANUAL_SELECT'>;
} | null;

const min = (m: number) => m * 60_000;
const byTime = (a?: Date | null, b?: Date | null) =>
  a!.getTime() - b!.getTime();

/** Flag off: emergency first, then strictly by arrival (sort anchor, then token). */
function selectFifo(c: Candidate[]): Decision {
  const urgent = c
    .filter((x) => x.urgentSince)
    .sort((a, b) => byTime(a.urgentSince, b.urgentSince) || a.token - b.token);
  if (urgent[0]) return { entryId: urgent[0].id, reason: 'URGENT' };
  const rest = c
    .filter((x) => !x.urgentSince)
    .sort(
      (a, b) => byTime(a.sortAnchorAt, b.sortAnchorAt) || a.token - b.token,
    );
  return rest[0] ? { entryId: rest[0].id, reason: 'FIFO' } : null;
}

/**
 * Order (smart mode): emergency → walk-in starvation guard → appointments
 * that are due → patients back from a test → FIFO pool (walk-ins, early
 * appointment patients, and late-beyond-grace appointment patients).
 */
export function selectNext(
  c: Candidate[],
  now: Date,
  p: SelectionPolicy,
  lastReason?: string | null,
): Decision {
  if (!p.smartQueueEnabled) return selectFifo(c);

  const isApptPriority = (x: Candidate) =>
    x.type === 'APPOINTMENT' &&
    !!x.scheduledStart &&
    now.getTime() >= x.scheduledStart.getTime() - min(p.earlyWindowMin) &&
    x.checkedInAt.getTime() <= x.scheduledStart.getTime() + min(p.lateGraceMin);

  const urgent = c
    .filter((x) => x.urgentSince)
    .sort((a, b) => byTime(a.urgentSince, b.urgentSince) || a.token - b.token);
  if (urgent[0]) return { entryId: urgent[0].id, reason: 'URGENT' };

  const appt = c
    .filter((x) => !x.urgentSince && isApptPriority(x))
    .sort(
      (a, b) => byTime(a.scheduledStart, b.scheduledStart) || a.token - b.token,
    );
  const returned = c
    .filter((x) => !x.urgentSince && !isApptPriority(x) && x.returnedFromHoldAt)
    .sort(
      (a, b) =>
        byTime(a.returnedFromHoldAt, b.returnedFromHoldAt) || a.token - b.token,
    );
  const fifo = c
    .filter(
      (x) => !x.urgentSince && !isApptPriority(x) && !x.returnedFromHoldAt,
    )
    .sort(
      (a, b) => byTime(a.sortAnchorAt, b.sortAnchorAt) || a.token - b.token,
    );

  // The guard only matters when an appointment patient would overtake; it
  // never fires twice in a row.
  const oldest = fifo[0];
  if (
    oldest &&
    appt.length &&
    lastReason !== 'STARVATION_GUARD' &&
    now.getTime() - oldest.sortAnchorAt.getTime() >= min(p.starvationMin)
  ) {
    return { entryId: oldest.id, reason: 'STARVATION_GUARD' };
  }
  if (appt[0]) return { entryId: appt[0].id, reason: 'APPOINTMENT_DUE' };
  if (returned[0])
    return { entryId: returned[0].id, reason: 'RETURNED_FROM_TEST' };
  if (oldest) return { entryId: oldest.id, reason: 'FIFO' };
  return null;
}
