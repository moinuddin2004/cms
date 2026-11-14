import type { EntryView, SessionView } from '../../types/queue.types';
import type { LaneGroups } from './board-model';

/** Flat list model of one lane (one FlashList, mixed row types). */
export type LaneItem =
  | { type: 'arrivals'; key: string }
  | { type: 'banner'; key: string; text: string }
  | { type: 'header'; key: string; title: string; count?: number }
  | { type: 'entry'; key: string; entry: EntryView }
  | { type: 'empty'; key: string; text: string };

/** The session line under the chips when the lane is not simply open. */
export function sessionBanner(session: SessionView): string | null {
  switch (session.status) {
    case 'waiting_for_doctor':
      return "The doctor hasn't started this session yet.";
    case 'paused':
      return session.pauseReason ? `Paused — ${session.pauseReason}` : 'Paused';
    case 'closed':
      return 'Session closed for today.';
    case 'open':
      return null;
  }
}

/**
 * Order: arrivals link, session banner, now serving, waiting, on hold /
 * skipped. Empty sections still show a header with a short line, so the
 * reception desk sees the lane is live rather than broken.
 */
export function buildLaneItems(
  session: SessionView,
  groups: LaneGroups,
  showArrivals: boolean,
): LaneItem[] {
  const items: LaneItem[] = [];
  if (showArrivals) items.push({ type: 'arrivals', key: 'arrivals' });
  const banner = sessionBanner(session);
  if (banner) items.push({ type: 'banner', key: 'banner', text: banner });

  items.push({ type: 'header', key: 'h-now', title: 'Now serving' });
  if (groups.now.length === 0) items.push({ type: 'empty', key: 'e-now', text: 'No one with the doctor.' });
  for (const entry of groups.now) items.push({ type: 'entry', key: entry.id, entry });

  items.push({ type: 'header', key: 'h-wait', title: 'Waiting', count: groups.waiting.length });
  if (groups.waiting.length === 0) items.push({ type: 'empty', key: 'e-wait', text: 'No one is waiting.' });
  for (const entry of groups.waiting) items.push({ type: 'entry', key: entry.id, entry });

  if (groups.held.length > 0) {
    items.push({ type: 'header', key: 'h-held', title: 'On hold / Skipped', count: groups.held.length });
    for (const entry of groups.held) items.push({ type: 'entry', key: entry.id, entry });
  }
  return items;
}
