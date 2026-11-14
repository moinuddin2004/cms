import type { BoardResponse, EntryView, LaneDoctor, QueueLane, SessionSnapshot } from '../../types/queue.types';

/**
 * Pure view-model of the reception board (S-02b): which lanes have a session,
 * which are waiting to be opened, and how one lane's entries split into
 * "now serving", waiting (server order) and on-hold / skipped.
 */

export interface OpenLane {
  doctor: LaneDoctor;
  snapshot: SessionSnapshot;
  waitingCount: number;
}

export interface LaneGroups {
  /** `called` / `in_consultation` — the patient with the doctor. */
  now: EntryView[];
  /** `waitingOrder` first, then any waiting entry the order does not list (defensive). */
  waiting: EntryView[];
  /** `on_hold` (sent for test) and `skipped`. */
  held: EntryView[];
}

export function openLanes(board: BoardResponse): OpenLane[] {
  const out: OpenLane[] = [];
  for (const lane of board.lanes) {
    if (lane.snapshot === null) continue;
    out.push({
      doctor: lane.doctor,
      snapshot: lane.snapshot,
      waitingCount: lane.snapshot.entries.filter((e) => e.status === 'waiting').length,
    });
  }
  return out;
}

/** Doctors without a session today — the `[+]` picker. */
export function closedLaneDoctors(board: BoardResponse): LaneDoctor[] {
  return board.lanes.filter((l: QueueLane) => l.snapshot === null).map((l) => l.doctor);
}

/** Which lane is shown: the chosen one if it still has a session, else the first open lane. */
export function pickActiveLane(lanes: OpenLane[], selectedDoctorId: string | null): OpenLane | null {
  return lanes.find((l) => l.doctor.id === selectedDoctorId) ?? lanes[0] ?? null;
}

export function groupLane(snapshot: SessionSnapshot): LaneGroups {
  const byId = new Map(snapshot.entries.map((e) => [e.id, e]));
  const waiting: EntryView[] = [];
  const seen = new Set<string>();
  for (const id of snapshot.waitingOrder) {
    const entry = byId.get(id);
    if (entry && entry.status === 'waiting') {
      waiting.push(entry);
      seen.add(id);
    }
  }
  for (const entry of snapshot.entries) {
    if (entry.status === 'waiting' && !seen.has(entry.id)) waiting.push(entry);
  }
  return {
    now: snapshot.entries.filter((e) => e.status === 'called' || e.status === 'in_consultation'),
    waiting,
    held: snapshot.entries.filter((e) => e.status === 'on_hold' || e.status === 'skipped'),
  };
}

/** Whole minutes between check-in and the server's `now`; never negative. */
export function waitedMinutes(checkedInAt: string, nowIso: string): number {
  const diff = Date.parse(nowIso) - Date.parse(checkedInAt);
  return Number.isFinite(diff) && diff > 0 ? Math.floor(diff / 60_000) : 0;
}
