import type { EntryView } from '../types/queue.types';
import { buildDecisions, canTransferEntry, closeLeftovers } from './close-decisions';

const entry = (id: string, status: EntryView['status'], at = '2026-11-15T05:00:00Z') =>
  ({ id, status, checkedInAt: at }) as EntryView;

describe('close decisions', () => {
  const entries = [
    entry('w1', 'waiting', '2026-11-15T06:00:00Z'),
    entry('s1', 'skipped', '2026-11-15T05:00:00Z'),
    entry('h1', 'on_hold', '2026-11-15T07:00:00Z'),
    entry('done', 'completed'),
    entry('c1', 'cancelled'),
  ];

  it('lists waiting, skipped and on-hold patients, oldest first', () => {
    expect(closeLeftovers(entries).map((e) => e.id)).toEqual(['s1', 'w1', 'h1']);
  });

  it('only a waiting patient can transfer, and only with another doctor', () => {
    expect(canTransferEntry(entry('a', 'waiting'), true)).toBe(true);
    expect(canTransferEntry(entry('a', 'waiting'), false)).toBe(false);
    expect(canTransferEntry(entry('a', 'skipped'), true)).toBe(false);
  });

  it('3 leftovers send 3 decisions; skipped / on-hold are cancelled without a tap', () => {
    const left = closeLeftovers(entries);
    const out = buildDecisions(
      left,
      { w1: { action: 'transfer', toDoctorId: 'd2' } },
      true,
    );
    expect(out).toEqual([
      { entryId: 's1', action: 'cancel' },
      { entryId: 'w1', action: 'transfer', toDoctorId: 'd2' },
      { entryId: 'h1', action: 'cancel' },
    ]);
  });

  it('is incomplete while a waiting patient is undecided or a transfer has no doctor', () => {
    const left = closeLeftovers(entries);
    expect(buildDecisions(left, {}, true)).toBeNull();
    expect(buildDecisions(left, { w1: { action: 'transfer', toDoctorId: '' } }, true)).toBeNull();
  });

  it('with no other doctor everyone is cancelled', () => {
    expect(buildDecisions(closeLeftovers(entries), {}, false)?.every((d) => d.action === 'cancel')).toBe(true);
  });

  it('no leftovers → empty decisions', () => {
    expect(buildDecisions([], {}, true)).toEqual([]);
  });
});
