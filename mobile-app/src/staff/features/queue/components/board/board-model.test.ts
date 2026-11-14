import type { BoardResponse, EntryStatus, EntryView, SessionSnapshot } from '../../types/queue.types';
import {
  closedLaneDoctors,
  groupLane,
  openLanes,
  pickActiveLane,
  waitedMinutes,
} from './board-model';
import { buildLaneItems, sessionBanner } from './lane-items';

function entry(id: string, status: EntryStatus, extra: Partial<EntryView> = {}): EntryView {
  return { id, status, token: id.toUpperCase(), priorityClass: 'normal', version: 1, ...extra } as EntryView;
}

function snapshot(entries: EntryView[], waitingOrder: string[], status = 'open'): SessionSnapshot {
  return {
    session: { id: 's', status, pauseReason: null },
    entries,
    waitingOrder,
    suggestion: null,
    now: '2026-11-15T10:00:00Z',
  } as unknown as SessionSnapshot;
}

const doc = (id: string) => ({ id, fullName: `Dr ${id}` }) as never;

describe('board model', () => {
  it('groups a lane: now, waiting in server order, on hold / skipped', () => {
    const snap = snapshot(
      [
        entry('a', 'in_consultation'),
        entry('b', 'waiting'),
        entry('c', 'waiting'),
        entry('d', 'on_hold'),
        entry('e', 'skipped'),
        entry('f', 'completed'),
        entry('g', 'waiting'),
      ],
      ['c', 'b'],
    );
    const g = groupLane(snap);
    expect(g.now.map((e) => e.id)).toEqual(['a']);
    // `g` is not in waitingOrder: appended after the ordered ones.
    expect(g.waiting.map((e) => e.id)).toEqual(['c', 'b', 'g']);
    expect(g.held.map((e) => e.id)).toEqual(['d', 'e']);
  });

  it('splits lanes into open (with waiting counts) and closed doctors', () => {
    const board = {
      lanes: [
        { doctor: doc('1'), snapshot: snapshot([entry('a', 'waiting'), entry('b', 'called')], ['a']) },
        { doctor: doc('2'), snapshot: null },
      ],
    } as unknown as BoardResponse;
    const open = openLanes(board);
    expect(open).toHaveLength(1);
    expect(open[0].waitingCount).toBe(1);
    expect(closedLaneDoctors(board).map((d) => d.id)).toEqual(['2']);
  });

  it('keeps the chosen lane, falls back to the first, or null', () => {
    const lanes = [
      { doctor: doc('1'), snapshot: snapshot([], []), waitingCount: 0 },
      { doctor: doc('2'), snapshot: snapshot([], []), waitingCount: 0 },
    ];
    expect(pickActiveLane(lanes, '2')?.doctor.id).toBe('2');
    expect(pickActiveLane(lanes, 'gone')?.doctor.id).toBe('1');
    expect(pickActiveLane([], null)).toBeNull();
  });

  it('counts whole minutes waited, never negative', () => {
    expect(waitedMinutes('2026-11-15T09:45:30Z', '2026-11-15T10:00:00Z')).toBe(14);
    expect(waitedMinutes('2026-11-15T10:05:00Z', '2026-11-15T10:00:00Z')).toBe(0);
    expect(waitedMinutes('nonsense', '2026-11-15T10:00:00Z')).toBe(0);
  });
});

describe('lane items', () => {
  it('banners for every non-open session state', () => {
    const s = (status: string, pauseReason: string | null = null) =>
      ({ status, pauseReason }) as never;
    expect(sessionBanner(s('open'))).toBeNull();
    expect(sessionBanner(s('paused', 'Lunch'))).toBe('Paused — Lunch');
    expect(sessionBanner(s('closed'))).toMatch(/closed/);
    expect(sessionBanner(s('waiting_for_doctor'))).toMatch(/hasn't started/);
  });

  it('orders arrivals, now, waiting, held and keeps empty sections visible', () => {
    const snap = snapshot([entry('a', 'waiting'), entry('d', 'on_hold')], ['a']);
    const items = buildLaneItems(snap.session, groupLane(snap), true);
    expect(items.map((i) => i.key)).toEqual([
      'arrivals',
      'h-now',
      'e-now',
      'h-wait',
      'a',
      'h-held',
      'd',
    ]);
    const empty = buildLaneItems(snap.session, groupLane(snapshot([], [])), false);
    expect(empty.map((i) => i.key)).toEqual(['h-now', 'e-now', 'h-wait', 'e-wait']);
  });
});
