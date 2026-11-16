import type { TFunction } from '@/core/i18n';

import type { ActiveQueueEntry } from '../types/queue.types';

export const isCalled = (e: Pick<ActiveQueueEntry, 'status'>) => e.status === 'called';

/** "You're next" / "1 person ahead of you" / "3 people ahead of you" / null when there is no place to show. */
export function aheadText(
  t: TFunction,
  entry: Pick<ActiveQueueEntry, 'status' | 'peopleAhead'>,
): string | null {
  if (entry.status === 'called' || entry.status === 'in_consultation') return null;
  const n = entry.peopleAhead;
  if (n === null) return null;
  if (n === 0) return t('visit.next');
  return t(n === 1 ? 'visit.aheadOne' : 'visit.aheadMany', { count: n });
}

/** The one-line summary on the Today card: "Token A-014 · 3 ahead · Dr Sana". */
export function cardLine(t: TFunction, e: ActiveQueueEntry): string {
  const parts = [t('visit.cardToken', { token: e.token })];
  if (isCalled(e)) parts.push(t('visit.called'));
  else if (e.status === 'in_consultation') parts.push(t('visit.inConsultation'));
  else if (e.peopleAhead !== null) {
    parts.push(
      e.peopleAhead === 0 ? t('visit.next') : t('visit.aheadShort', { count: e.peopleAhead }),
    );
  }
  if (e.doctorName) parts.push(e.doctorName);
  return parts.join(' · ');
}

/** Status label for the visit screen. */
export function statusText(t: TFunction, status: string): string {
  switch (status) {
    case 'called':
      return t('visit.called');
    case 'in_consultation':
      return t('visit.inConsultation');
    case 'on_hold':
      return t('visit.onHold');
    case 'skipped':
      return t('visit.skipped');
    default:
      return t('visit.waiting');
  }
}
